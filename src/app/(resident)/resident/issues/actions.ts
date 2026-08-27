"use server";

import { AuditAction, IssueCategory, IssuePriority, NotificationType, Prisma, VillageMembershipRole } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { revalidateAdminSidebar } from "@/lib/revalidate-admin-sidebar";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { MAX_IMAGES_PER_REQUEST } from "@/lib/image-constraints";
import { issueImageUploadUrl, type IssueImageInput } from "@/lib/issue-images";
import { verifyPlaceUploadToken } from "@/lib/place-upload.server";
import { ISSUE_CATEGORY_LABELS } from "@/lib/constants";
import { ISSUE_PRIORITY_LABELS } from "@/lib/issues/priority";
import { writeVillageAuditLog } from "@/lib/audit-log";
import { notificationMetadata } from "@/lib/notification-copy";

const issueInputSchema = z.object({
  title: z.string().min(5, "หัวข้อต้องมีอย่างน้อย 5 ตัวอักษร"),
  description: z.string().min(10, "รายละเอียดต้องมีอย่างน้อย 10 ตัวอักษร"),
  imageUrls: z.array(z.object({
    url: z.string().min(1, "รูปภาพไม่ถูกต้อง"),
    fileKey: z.string().optional(),
    uploadToken: z.string().optional(),
    fileName: z.string().optional(),
    sizeBytes: z.number().int().positive().max(5 * 1024 * 1024).optional(),
  }).strict()).max(MAX_IMAGES_PER_REQUEST).optional(),
  isPublic: z.boolean().optional(),
  category: z.string().min(1, "กรุณาเลือกหมวดหมู่"),
  priority: z.string().min(1, "กรุณาเลือกระดับความสำคัญ"),
  location: z.string().optional(),
});

type IssueInput = {
  title: string;
  description: string;
  imageUrls?: IssueImageInput[];
  isPublic?: boolean;
  category: string;
  priority: string;
  location?: string;
};

const ADMIN_MEMBERSHIP_ROLES: VillageMembershipRole[] = [
  VillageMembershipRole.HEADMAN,
  VillageMembershipRole.ASSISTANT_HEADMAN,
];

async function resolveIssueImageUrls(
  images: readonly IssueImageInput[],
  villageId: string,
  uploaderId: string,
  existingUrls: readonly string[] = []
) {
  const resolved: string[] = [];
  for (const image of images) {
    const url = image.url.trim();
    if (image.fileKey || image.uploadToken) {
      if (!image.fileKey || !image.uploadToken || url !== issueImageUploadUrl(image.fileKey)) return null;
      if (!verifyPlaceUploadToken(image.uploadToken, image.fileKey, villageId, uploaderId)) return null;
      resolved.push(url);
      continue;
    }
    if (!existingUrls.includes(url)) return null;
    resolved.push(url);
  }
  return resolved;
}

async function notifyVillageAdmins(
  villageId: string,
  title: string,
  body: string,
  metadata?: Prisma.InputJsonObject
) {
  const admins = await prisma.villageMembership.findMany({
    where: {
      villageId,
      status: "ACTIVE",
      role: { in: ADMIN_MEMBERSHIP_ROLES },
    },
    select: { userId: true },
  });

  const userIds = Array.from(new Set(admins.map((item) => item.userId)));
  if (userIds.length === 0) return;

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      villageId,
      userId,
      type: NotificationType.ISSUE_UPDATE,
      title,
      body,
      metadata: notificationMetadata("ISSUE", metadata ?? {}),
    })),
  });
}

export async function createIssueAction(
  data: IssueInput
): Promise<{ success: true; issueId: string } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบอีกครั้ง" };

  const parsed = issueInputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง",
    };
  }

  const membership = getResidentMembership(session);
  if (!membership) return { success: false, error: "ไม่พบหมู่บ้านของคุณ" };
  const imageUrls = await resolveIssueImageUrls(parsed.data.imageUrls ?? [], membership.villageId, session.id);
  if (!imageUrls) return { success: false, error: "รูปภาพต้องอัปโหลดผ่านระบบก่อนส่งคำร้อง" };

  const issue = await prisma.issue.create({
    data: {
      villageId: membership.villageId,
      reporterId: session.id,
      title: parsed.data.title,
      description: parsed.data.description,
      imageUrls,
      isPublic: Boolean(parsed.data.isPublic),
      category: parsed.data.category as IssueCategory,
      priority: parsed.data.priority as IssuePriority,
      location: parsed.data.location?.trim() || null,
      stage: "WAITING",
    },
  });

  await prisma.issueTimeline.create({
    data: {
      issueId: issue.id,
      actorId: session.id,
      action: "สร้างคำร้อง",
      description: "สร้างคำร้องใหม่",
      metadata: { eventType: "ISSUE_CREATED", createdBy: "RESIDENT" },
    },
  });

  await notifyVillageAdmins(
    membership.villageId,
    "มีการแจ้งปัญหาใหม่",
    parsed.data.title,
    { issueId: issue.id, reporterId: session.id }
  );

  revalidatePath("/resident/issues");
  revalidatePath("/resident/dashboard");
  revalidatePath("/admin/issues");
  revalidateAdminSidebar();

  return { success: true, issueId: issue.id };
}

export async function editIssueAction(
  issueId: string,
  data: IssueInput
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบอีกครั้ง" };

  const parsed = issueInputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง",
    };
  }

  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) return { success: false, error: "ไม่พบคำร้อง" };
  const membership = getResidentMembership(session);
  if (!membership || membership.villageId !== issue.villageId) {
    return { success: false, error: "ไม่มีสิทธิ์เข้าถึงคำร้องในหมู่บ้านนี้" };
  }
  if (issue.reporterId !== session.id) return { success: false, error: "ไม่มีสิทธิ์แก้ไขคำร้องนี้" };
  if (issue.stage !== "OPEN" && issue.stage !== "WAITING") {
    return { success: false, error: "แก้ไขได้เฉพาะคำร้องที่ยังไม่ถูกรับไปดำเนินการ" };
  }
  const storedImageUrls = Array.isArray(issue.imageUrls)
    ? issue.imageUrls.filter((value): value is string => typeof value === "string")
    : [];
  const imageUrls = await resolveIssueImageUrls(parsed.data.imageUrls ?? [], issue.villageId, session.id, storedImageUrls);
  if (!imageUrls) return { success: false, error: "รูปภาพเดิมไม่ถูกต้องหรือรูปใหม่ยังอัปโหลดไม่เสร็จ" };

  const changes: string[] = [];
  const changeDetails: Prisma.InputJsonObject[] = [];
  if (issue.title !== parsed.data.title) changes.push("หัวข้อ");
  if (issue.title !== parsed.data.title) changeDetails.push({
    field: "title",
    label: "หัวข้อ",
    ...(issue.title.length <= 500 && parsed.data.title.length <= 500
      ? { before: issue.title, after: parsed.data.title }
      : { summary: "มีการแก้ไขหัวข้อคำร้อง" }),
  });
  if (issue.description !== parsed.data.description) {
    changes.push("รายละเอียด");
    changeDetails.push({ field: "description", label: "รายละเอียด", summary: "มีการแก้ไขรายละเอียดคำร้อง", ...(issue.description.length <= 500 && parsed.data.description.length <= 500 ? { beforeText: issue.description, afterText: parsed.data.description } : {}) });
  }
  if (issue.category !== parsed.data.category) {
    changes.push("หมวดหมู่");
    changeDetails.push({ field: "category", label: "หมวดหมู่", before: ISSUE_CATEGORY_LABELS[issue.category], after: ISSUE_CATEGORY_LABELS[parsed.data.category] });
  }
  if (issue.priority !== parsed.data.priority) {
    const before = ISSUE_PRIORITY_LABELS[issue.priority];
    const after = ISSUE_PRIORITY_LABELS[parsed.data.priority];
    changes.push(`ความสำคัญ: ${before} → ${after}`);
    changeDetails.push({ field: "priority", label: "ความสำคัญ", before, after });
  }
  const nextLocation = parsed.data.location?.trim() || "";
  if ((issue.location ?? "") !== nextLocation) {
    changes.push("สถานที่");
    changeDetails.push({ field: "location", label: "สถานที่", before: issue.location ?? null, after: nextLocation || null });
  }
  const oldImageUrls = storedImageUrls;
  const addedImageCount = imageUrls.filter((url) => !oldImageUrls.includes(url)).length;
  const removedImageCount = oldImageUrls.filter((url) => !imageUrls.includes(url)).length;
  const reorderedImages = oldImageUrls.length === imageUrls.length && oldImageUrls.some((url, index) => imageUrls[index] !== url);
  if (addedImageCount || removedImageCount || reorderedImages) {
    changes.push("รูปภาพ");
    changeDetails.push({ field: "images", label: "รูปภาพ", addedCount: addedImageCount, removedCount: removedImageCount, reordered: reorderedImages });
  }
  if (issue.isPublic !== Boolean(parsed.data.isPublic)) {
    changes.push("การมองเห็น");
    changeDetails.push({ field: "visibility", label: "การมองเห็น", before: issue.isPublic ? "เปิดเผยต่อชุมชน" : "เฉพาะผู้แจ้งและผู้ดูแล", after: parsed.data.isPublic ? "เปิดเผยต่อชุมชน" : "เฉพาะผู้แจ้งและผู้ดูแล" });
  }

  await prisma.issue.update({
    where: { id: issueId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      imageUrls,
      isPublic: Boolean(parsed.data.isPublic),
      category: parsed.data.category as IssueCategory,
      priority: parsed.data.priority as IssuePriority,
      location: parsed.data.location?.trim() || null,
    },
  });

  await prisma.issueTimeline.create({
    data: {
      issueId,
      actorId: session.id,
      metadata: { eventType: "ISSUE_EDITED", changes: changeDetails },
      action: "แก้ไขคำร้อง",
      description: changes.length > 0 ? `แก้ไข: ${changes.join(", ")}` : "ปรับปรุงข้อมูลคำร้อง",
    },
  });

  await notifyVillageAdmins(
    issue.villageId,
    "มีการแก้ไขคำร้องโดยผู้แจ้ง",
    parsed.data.title,
    { issueId, reporterId: session.id }
  );

  revalidatePath("/resident/issues");
  revalidatePath(`/resident/issues/${issueId}`);
  revalidatePath("/resident/saved");
  revalidatePath("/admin/issues");

  return { success: true };
}

export async function deleteIssueAction(
  issueId: string,
  reason: string
): Promise<{ success: true } | { success: false; error: string }> {
  const trimmedReason = reason.trim();
  if (trimmedReason.length < 5 || trimmedReason.length > 500) {
    return { success: false, error: "เหตุผลในการลบต้องมี 5–500 ตัวอักษร" };
  }

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบอีกครั้ง" };

  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) return { success: false, error: "ไม่พบคำร้อง" };
  const membership = getResidentMembership(session);
  if (!membership || membership.villageId !== issue.villageId) {
    return { success: false, error: "ไม่มีสิทธิ์เข้าถึงคำร้องในหมู่บ้านนี้" };
  }
  if (issue.reporterId !== session.id) return { success: false, error: "ไม่มีสิทธิ์ลบคำร้องนี้" };
  if (issue.stage !== "OPEN" && issue.stage !== "WAITING") {
    return { success: false, error: "ลบได้เฉพาะคำร้องที่สถานะ 'เปิด' เท่านั้น" };
  }

  // The notification and audit record are independent of Issue, so create them
  // in the same transaction before the Issue's dependent records cascade away.
  await prisma.$transaction(async (tx) => {
    const admins = await tx.villageMembership.findMany({
      where: {
        villageId: issue.villageId,
        status: "ACTIVE",
        role: { in: ADMIN_MEMBERSHIP_ROLES },
      },
      select: { userId: true },
    });
    const adminIds = Array.from(new Set(admins.map((admin) => admin.userId)));
    if (adminIds.length > 0) {
      await tx.notification.createMany({
        data: adminIds.map((userId) => ({
          villageId: issue.villageId,
          userId,
          type: NotificationType.ISSUE_UPDATE,
          title: "ลูกบ้านลบคำร้องปัญหา",
          body: `หัวข้อ: ${issue.title}\nผู้ลบ: ${session.name}\nเหตุผล: ${trimmedReason}`,
          metadata: notificationMetadata("ISSUE", { action: "ISSUE_DELETED_BY_RESIDENT", issueTitle: issue.title, deletedBy: session.name, deletionReason: trimmedReason }),
        })),
      });
    }
    await writeVillageAuditLog(tx, {
      villageId: issue.villageId,
      userId: session.id,
      action: AuditAction.DELETE,
      resource: "Issue",
      resourceId: issue.id,
      metadata: { actionName: "ISSUE_DELETED_BY_RESIDENT", issueTitle: issue.title, reason: trimmedReason },
    });
    await tx.savedItem.deleteMany({ where: { issueId } });
    await tx.issue.delete({ where: { id: issueId } });
  });
  revalidatePath("/resident/issues");
  revalidatePath("/admin/issues");
  revalidatePath(`/resident/issues/${issueId}`);
  revalidatePath(`/admin/issues/${issueId}`);
  revalidatePath("/resident/saved");
  revalidatePath("/resident/notifications");
  revalidatePath("/admin/notifications");
  revalidateAdminSidebar();
  return { success: true };
}

export async function addIssueMessageAction(
  issueId: string,
  content: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบอีกครั้ง" };

  const trimmed = content.trim();
  if (trimmed.length < 2) return { success: false, error: "กรุณาระบุข้อความ (อย่างน้อย 2 ตัวอักษร)" };

  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) return { success: false, error: "ไม่พบคำร้อง" };

  const membership = getResidentMembership(session);
  if (!membership || membership.villageId !== issue.villageId) {
    return { success: false, error: "ไม่มีสิทธิ์แสดงความคิดเห็นในหมู่บ้านนี้" };
  }

  if (issue.reporterId !== session.id && !issue.isPublic) {
    return { success: false, error: "ไม่สามารถส่งข้อความในคำร้องส่วนตัวของผู้อื่น" };
  }

  await prisma.issueMessage.create({
    data: {
      issueId,
      senderId: session.id,
      content: trimmed,
      isInternal: false,
    },
  });
  await prisma.issueTimeline.create({
    data: { issueId, actorId: session.id, action: "แสดงความคิดเห็น", description: trimmed, metadata: { eventType: "COMMENT" } },
  });

  await notifyVillageAdmins(
    issue.villageId,
    "มีข้อความใหม่ในคำร้อง",
    trimmed,
    { issueId }
  );

  revalidatePath(`/resident/issues/${issueId}`);
  revalidatePath(`/admin/issues/${issueId}`);
  revalidatePath("/resident/notifications");
  revalidatePath("/admin/notifications");

  return { success: true };
}
