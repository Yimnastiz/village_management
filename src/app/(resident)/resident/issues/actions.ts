"use server";

import { IssueCategory, IssuePriority, NotificationType, Prisma, VillageMembershipRole } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";

const issueInputSchema = z.object({
  title: z.string().min(5, "หัวข้อต้องมีอย่างน้อย 5 ตัวอักษร"),
  description: z.string().min(10, "รายละเอียดต้องมีอย่างน้อย 10 ตัวอักษร"),
  imageUrls: z.array(z.string().min(1, "รูปภาพไม่ถูกต้อง")).optional(),
  isPublic: z.boolean().optional(),
  category: z.string().min(1, "กรุณาเลือกหมวดหมู่"),
  priority: z.string().min(1, "กรุณาเลือกระดับความสำคัญ"),
  location: z.string().optional(),
});

type IssueInput = {
  title: string;
  description: string;
  imageUrls?: string[];
  isPublic?: boolean;
  category: string;
  priority: string;
  location?: string;
};

const ADMIN_MEMBERSHIP_ROLES: VillageMembershipRole[] = [
  VillageMembershipRole.HEADMAN,
  VillageMembershipRole.ASSISTANT_HEADMAN,
  VillageMembershipRole.COMMITTEE,
];

function isSupportedImageSource(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("data:image/")) return true;
  if (/^https?:\/\//i.test(trimmed)) return true;
  return false;
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
      ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}),
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

  const imageUrls = (parsed.data.imageUrls ?? []).map((url) => url.trim()).filter((url) => url.length > 0);
  if (imageUrls.some((url) => !isSupportedImageSource(url))) {
    return { success: false, error: "รูปภาพต้องเป็นไฟล์อัปโหลดหรือ URL ที่ถูกต้อง" };
  }

  const membership = getResidentMembership(session);
  if (!membership) return { success: false, error: "ไม่พบหมู่บ้านของคุณ" };

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
    },
  });

  await prisma.issueTimeline.create({
    data: {
      issueId: issue.id,
      actorId: session.id,
      action: "แจ้งปัญหา",
      description: "สร้างคำร้องใหม่",
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

  const imageUrls = (parsed.data.imageUrls ?? []).map((url) => url.trim()).filter((url) => url.length > 0);
  if (imageUrls.some((url) => !isSupportedImageSource(url))) {
    return { success: false, error: "รูปภาพต้องเป็นไฟล์อัปโหลดหรือ URL ที่ถูกต้อง" };
  }

  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) return { success: false, error: "ไม่พบคำร้อง" };
  if (issue.reporterId !== session.id) return { success: false, error: "ไม่มีสิทธิ์แก้ไขคำร้องนี้" };
  if (issue.stage !== "OPEN") {
    return { success: false, error: "แก้ไขได้เฉพาะคำร้องที่ยังไม่ถูกรับไปดำเนินการ" };
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
      action: "แก้ไขคำร้อง",
      description: "ผู้แจ้งแก้ไขรายละเอียดคำร้อง",
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
  revalidatePath("/admin/issues");

  return { success: true };
}

export async function deleteIssueAction(
  issueId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบอีกครั้ง" };

  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) return { success: false, error: "ไม่พบคำร้อง" };
  if (issue.reporterId !== session.id) return { success: false, error: "ไม่มีสิทธิ์ลบคำร้องนี้" };
  if (issue.stage !== "OPEN") {
    return { success: false, error: "ลบได้เฉพาะคำร้องที่สถานะ 'เปิด' เท่านั้น" };
  }

  await prisma.issue.delete({ where: { id: issueId } });
  revalidatePath("/resident/issues");
  revalidatePath("/admin/issues");
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

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, villageId: issue.villageId, status: "ACTIVE" },
  });
  if (!membership && issue.reporterId !== session.id) {
    return { success: false, error: "ไม่มีสิทธิ์แสดงความคิดเห็น" };
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
