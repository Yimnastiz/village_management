"use server";

import { NewsStage, NewsVisibility, NotificationType, Prisma, VillageMembershipRole } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, getResidentMembership } from "@/lib/access-control";

const requestSchema = z.object({
  title: z.string().min(3, "กรุณาระบุหัวข้อข่าว"),
  summary: z.string().optional(),
  content: z.string().min(10, "กรุณาระบุเนื้อหาอย่างน้อย 10 ตัวอักษร"),
  imageUrls: z.array(z.string().min(1, "รูปภาพไม่ถูกต้อง")).optional(),
  visibility: z.string().min(1, "กรุณาเลือกการแสดงผล"),
  stage: z.string().min(1, "กรุณาเลือกสถานะ"),
  isPinned: z.boolean().optional(),
});

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
      type: NotificationType.NEWS,
      title,
      body,
      ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}),
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

  const visibility = parsed.data.visibility as NewsVisibility;
  const stage = parsed.data.stage as NewsStage;

  if (!VALID_VISIBILITY.includes(visibility)) {
    return { ok: false as const, error: "ประเภทการแสดงผลไม่ถูกต้อง" };
  }
  if (!VALID_STAGE.includes(stage)) {
    return { ok: false as const, error: "สถานะข่าวไม่ถูกต้อง" };
  }

  const imageUrls = (parsed.data.imageUrls ?? []).map((url) => url.trim()).filter((url) => url.length > 0);
  if (imageUrls.some((url) => !isSupportedImageSource(url))) {
    return { ok: false as const, error: "รูปภาพต้องเป็นไฟล์ที่อัปโหลดหรือ URL ที่ถูกต้อง" };
  }

  return {
    ok: true as const,
    value: {
      title: parsed.data.title.trim(),
      summary: parsed.data.summary?.trim() || "",
      content: parsed.data.content.trim(),
      imageUrls,
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

  // Resident can save drafts directly without waiting for admin approval.
  if (normalized.value.stage === "DRAFT") {
    const createdDraft = await prisma.news.create({
      data: {
        villageId: ctx.villageId,
        authorId: ctx.userId,
        title: normalized.value.title,
        summary: normalized.value.summary || null,
        content: normalized.value.content,
        imageUrls: normalized.value.imageUrls,
        visibility: normalized.value.visibility,
        stage: "DRAFT",
        isPinned: normalized.value.isPinned,
      },
      select: { id: true },
    });

    revalidatePath("/resident/news");
    revalidatePath("/resident/dashboard");

    return { success: true, newsId: createdDraft.id };
  }

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
    select: { id: true },
  });

  if (!existing) {
    return { success: false, error: "ไม่พบคำขอที่แก้ไขได้ (ต้องเป็นคำขอที่รออนุมัติ)" };
  }

  const normalized = normalizeInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  await prisma.newsSubmission.update({
    where: { id: submissionId },
    data: {
      payload: normalized.value,
      updatedAt: new Date(),
    },
  });

  revalidatePath("/resident/news/requests");
  revalidatePath(`/resident/news/requests/${submissionId}`);

  return { success: true };
}

export async function deletePendingNewsSubmissionAction(
  submissionId: string
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
    select: { id: true },
  });

  if (!existing) {
    return { success: false, error: "ไม่พบคำขอที่ลบได้ (ต้องเป็นคำขอที่รออนุมัติ)" };
  }

  await prisma.newsSubmission.delete({ where: { id: submissionId } });
  revalidatePath("/resident/news/requests");
  return { success: true };
}
