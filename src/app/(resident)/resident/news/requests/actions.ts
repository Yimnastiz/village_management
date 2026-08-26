"use server";

import { NewsStage, NewsVisibility, NotificationType, Prisma, VillageMembershipRole } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { revalidateAdminSidebar } from "@/lib/revalidate-admin-sidebar";
import { getSessionContextFromServerCookies, getResidentMembership } from "@/lib/access-control";
import { areSafeImageSources } from "@/lib/image-input";
import { notificationMetadata } from "@/lib/notification-copy";

const requestSchema = z.object({
  title: z.string().min(3, "กรุณาระบุหัวข้อข่าว"),
  summary: z.string().optional(),
  content: z.string().min(10, "กรุณาระบุเนื้อหาอย่างน้อย 10 ตัวอักษร"),
  imageUrls: z.array(z.string().min(1, "รูปภาพไม่ถูกต้อง")).optional(),
  coverUrl: z.string().nullable().optional(),
  visibility: z.string().optional(),
  stage: z.string().optional(),
  isPinned: z.boolean().optional(),
});

const deleteRequestReasonSchema = z.string().trim().min(5, "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร");

type RequestInput = z.infer<typeof requestSchema>;

const VALID_VISIBILITY: NewsVisibility[] = ["PUBLIC", "RESIDENT_ONLY"];
const VALID_STAGE: NewsStage[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const ADMIN_MEMBERSHIP_ROLES: VillageMembershipRole[] = [
  VillageMembershipRole.HEADMAN,
  VillageMembershipRole.ASSISTANT_HEADMAN,
  VillageMembershipRole.COMMITTEE,
];

async function requireResidentVillage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    return { ok: false as const, error: "กรุณาเข้าสู่ระบบ", userId: "", villageId: "" };
  }

  const membership = getResidentMembership(session);
  if (!membership) {
    return { ok: false as const, error: "ไม่พบหมู่บ้านของคุณ", userId: "", villageId: "" };
  }

  return { ok: true as const, error: null, userId: session.id, villageId: membership.villageId };
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
      type: NotificationType.NEWS,
      title,
      body,
      metadata: notificationMetadata("NEWS", metadata ?? {}),
    })),
  });
}

function normalizeInput(data: RequestInput) {
  const parsed = requestSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false as const,
      error:
        Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง",
    };
  }

  const visibility = (parsed.data.visibility || "PUBLIC") as NewsVisibility;
  const stage = (parsed.data.stage || "DRAFT") as NewsStage;

  if (!VALID_VISIBILITY.includes(visibility)) {
    return { ok: false as const, error: "ประเภทการแสดงผลไม่ถูกต้อง" };
  }
  if (!VALID_STAGE.includes(stage)) {
    return { ok: false as const, error: "สถานะข่าวไม่ถูกต้อง" };
  }

  const imageUrls = (parsed.data.imageUrls ?? []).map((url) => url.trim()).filter((url) => url.length > 0);
  if (!areSafeImageSources(imageUrls)) {
    return { ok: false as const, error: "รูปภาพต้องเป็นไฟล์ที่อัปโหลดหรือ URL ที่ถูกต้อง" };
  }

  return {
    ok: true as const,
    value: {
      title: parsed.data.title.trim(),
      summary: parsed.data.summary?.trim() || "",
      content: parsed.data.content.trim(),
      imageUrls,
      coverUrl: imageUrls.includes(parsed.data.coverUrl ?? "") ? parsed.data.coverUrl ?? null : imageUrls[0] ?? null,
      visibility,
      stage,
      isPinned: Boolean(parsed.data.isPinned),
    },
  };
}

export async function createNewsCreateRequestAction(
  data: RequestInput
): Promise<{ success: true; requestId?: string; newsId?: string } | { success: false; error: string }> {
  const ctx = await requireResidentVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalized = normalizeInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const created = await prisma.newsSubmission.create({
    data: {
      villageId: ctx.villageId,
      requesterId: ctx.userId,
      type: "CREATE",
      payload: normalized.value,
    },
    select: { id: true },
  });

  await notifyVillageAdmins(
    ctx.villageId,
    "มีคำขอข่าวใหม่จากลูกบ้าน",
    `หัวข้อ: ${normalized.value.title}`,
    { requestId: created.id, type: "CREATE" }
  );

  revalidatePath("/resident/news/requests");
  revalidateAdminSidebar();

  return { success: true, requestId: created.id };
}

export async function createNewsUpdateRequestAction(
  targetNewsId: string,
  data: RequestInput
): Promise<{ success: true; requestId: string } | { success: false; error: string }> {
  const ctx = await requireResidentVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const targetNews = await prisma.news.findFirst({
    where: {
      id: targetNewsId,
      villageId: ctx.villageId,
    },
    select: { id: true, authorId: true, title: true },
  });
  if (!targetNews) {
    return { success: false, error: "ไม่พบข่าวปลายทาง" };
  }

  if (!targetNews.authorId || targetNews.authorId !== ctx.userId) {
    return { success: false, error: "คุณสามารถขอแก้ไขได้เฉพาะข่าวที่คุณสร้างเอง" };
  }

  const normalized = normalizeInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const created = await prisma.newsSubmission.create({
    data: {
      villageId: ctx.villageId,
      requesterId: ctx.userId,
      type: "UPDATE",
      targetNewsId,
      payload: normalized.value,
    },
    select: { id: true },
  });

  await notifyVillageAdmins(
    ctx.villageId,
    "มีคำขอแก้ไขข่าวจากลูกบ้าน",
    `หัวข้อ: ${targetNews.title}`,
    { requestId: created.id, type: "UPDATE", targetNewsId }
  );

  revalidatePath("/resident/news/requests");
  revalidateAdminSidebar();

  return { success: true, requestId: created.id };
}

export async function updatePendingNewsSubmissionAction(
  submissionId: string,
  data: RequestInput
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireResidentVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const existing = await prisma.newsSubmission.findFirst({
    where: {
      id: submissionId,
      requesterId: ctx.userId,
      villageId: ctx.villageId,
      status: "PENDING",
    },
    select: { id: true, payload: true },
  });

  if (!existing || existing.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload) && existing.payload.isDeleteRequest === true) {
    return { success: false, error: "ไม่พบคำขอที่แก้ไขได้ (ต้องเป็นคำขอที่รออนุมัติ)" };
  }

  const normalized = normalizeInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const updated = await prisma.newsSubmission.updateMany({
    where: {
      id: submissionId,
      requesterId: ctx.userId,
      villageId: ctx.villageId,
      status: "PENDING",
      type: { in: ["CREATE", "UPDATE"] },
    },
    data: {
      payload: normalized.value,
      updatedAt: new Date(),
    },
  });

  if (updated.count !== 1) {
    return { success: false, error: "ไม่พบคำขอที่แก้ไขได้ (ต้องเป็นคำขอที่รออนุมัติ)" };
  }

  revalidatePath("/resident/news/requests");
  revalidateAdminSidebar();
  revalidatePath(`/resident/news/requests/${submissionId}`);

  return { success: true };
}

export async function deletePendingNewsSubmissionAction(
  submissionId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireResidentVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  // Keep the status check in the delete statement so an admin review that wins
  // the race cannot cause a reviewed request to be removed.
  const deleted = await prisma.newsSubmission.deleteMany({
    where: {
      id: submissionId,
      requesterId: ctx.userId,
      villageId: ctx.villageId,
      status: "PENDING",
      type: { in: ["CREATE", "UPDATE"] },
    },
  });

  if (deleted.count !== 1) {
    return { success: false, error: "ไม่พบคำขอที่ลบได้ (ต้องเป็นคำขอที่รออนุมัติ)" };
  }

  revalidatePath("/resident/news/requests");
  revalidateAdminSidebar();
  return { success: true };
}

export async function createNewsDeleteRequestAction(
  targetNewsId: string,
  reason: string
): Promise<{ success: true; requestId?: string } | { success: false; error: string }> {
  const ctx = await requireResidentVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const parsedReason = deleteRequestReasonSchema.safeParse(reason);
  if (!parsedReason.success) return { success: false, error: parsedReason.error.issues[0]?.message ?? "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร" };

  const targetNews = await prisma.news.findFirst({
    where: {
      id: targetNewsId,
      villageId: ctx.villageId,
      stage: "PUBLISHED",
    },
    select: {
      id: true,
      authorId: true,
      title: true,
      summary: true,
      content: true,
      imageUrls: true,
      visibility: true,
      stage: true,
      isPinned: true,
    },
  });
  if (!targetNews) {
    return { success: false, error: "ไม่พบข่าวปลายทางหรือข่าวนี้ไม่ได้เผยแพร่อยู่" };
  }

  if (!targetNews.authorId || targetNews.authorId !== ctx.userId) {
    return { success: false, error: "คุณสามารถขอแก้ไขหรือลบได้เฉพาะข่าวที่คุณสร้างเอง" };
  }

  // Check if there is already a pending request for this news
  const existingPending = await prisma.newsSubmission.findFirst({
    where: {
      targetNewsId,
      villageId: ctx.villageId,
      status: "PENDING",
    },
  });
  if (existingPending) {
    return { success: false, error: "มีคำขอที่อยู่ระหว่างดำเนินการสำหรับข่าวนี้แล้ว" };
  }

  const created = await prisma.newsSubmission.create({
    data: {
      villageId: ctx.villageId,
      requesterId: ctx.userId,
      type: "UPDATE",
      targetNewsId,
      payload: {
        title: targetNews.title,
        summary: targetNews.summary || "",
        content: targetNews.content,
        imageUrls: targetNews.imageUrls || [],
        visibility: targetNews.visibility,
        stage: targetNews.stage,
        isPinned: targetNews.isPinned,
        isDeleteRequest: true,
        deleteReason: parsedReason.data,
      },
    },
    select: { id: true },
  });

  await notifyVillageAdmins(
    ctx.villageId,
    "มีคำขอลบข่าวจากลูกบ้าน",
    `หัวข้อ: ${targetNews.title}`,
    { requestId: created.id, type: "UPDATE", targetNewsId }
  );

  revalidatePath("/resident/news/requests");
  revalidateAdminSidebar();

  return { success: true, requestId: created.id };
}

