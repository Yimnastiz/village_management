"use server";

import {
  NewsStage,
  NewsVisibility,
  NotificationType,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";

const newsInputSchema = z.object({
  title: z.string().min(3, "กรุณาระบุหัวข้อข่าว"),
  summary: z.string().optional(),
  content: z.string().min(10, "กรุณาระบุเนื้อหาอย่างน้อย 10 ตัวอักษร"),
  imageUrls: z.array(z.string().url("URL รูปภาพไม่ถูกต้อง")).optional(),
  visibility: z.string().min(1, "กรุณาเลือกการแสดงผล"),
  stage: z.string().min(1, "กรุณาเลือกสถานะ"),
  isPinned: z.boolean().optional(),
});

type NewsInput = {
  title: string;
  summary?: string;
  content: string;
  imageUrls?: string[];
  visibility: string;
  stage: string;
  isPinned?: boolean;
};

const VALID_VISIBILITY: NewsVisibility[] = ["PUBLIC", "RESIDENT_ONLY"];
const VALID_STAGE: NewsStage[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

async function requireAdminVillage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    return { ok: false as const, error: "กรุณาเข้าสู่ระบบ", session: null, villageId: "" };
  }
  if (!isAdminUser(session)) {
    return { ok: false as const, error: "ไม่มีสิทธิ์ดำเนินการ", session: null, villageId: "" };
  }

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
  });
  if (!membership) {
    return { ok: false as const, error: "ไม่พบหมู่บ้านของคุณ", session: null, villageId: "" };
  }

  return {
    ok: true as const,
    error: null,
    session,
    villageId: membership.villageId,
  };
}

function normalizeNewsInput(data: NewsInput) {
  const parsed = newsInputSchema.safeParse(data);
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

  return {
    ok: true as const,
    value: {
      title: parsed.data.title.trim(),
      summary: parsed.data.summary?.trim() || null,
      content: parsed.data.content.trim(),
      imageUrls: (parsed.data.imageUrls ?? []).filter((url) => url.trim().length > 0),
      visibility,
      stage,
      isPinned: Boolean(parsed.data.isPinned),
    },
  };
}

export async function adminCreateNewsAction(
  data: NewsInput
): Promise<{ success: true; newsId: string } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalized = normalizeNewsInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const news = await prisma.news.create({
    data: {
      villageId: ctx.villageId,
      title: normalized.value.title,
      summary: normalized.value.summary,
      content: normalized.value.content,
      imageUrls: normalized.value.imageUrls,
      visibility: normalized.value.visibility,
      stage: normalized.value.stage,
      isPinned: normalized.value.isPinned,
      authorId: ctx.session.id,
      publishedAt: normalized.value.stage === "PUBLISHED" ? new Date() : null,
    },
  });

  return { success: true, newsId: news.id };
}

export async function adminUpdateNewsAction(
  newsId: string,
  data: NewsInput
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalized = normalizeNewsInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const existing = await prisma.news.findFirst({
    where: { id: newsId, villageId: ctx.villageId },
    select: { id: true, stage: true, publishedAt: true },
  });
  if (!existing) {
    return { success: false, error: "ไม่พบข่าวนี้หรือไม่มีสิทธิ์แก้ไข" };
  }

  const shouldSetPublishedAt =
    normalized.value.stage === "PUBLISHED" &&
    (existing.stage !== "PUBLISHED" || !existing.publishedAt);

  await prisma.news.update({
    where: { id: newsId },
    data: {
      title: normalized.value.title,
      summary: normalized.value.summary,
      content: normalized.value.content,
      imageUrls: normalized.value.imageUrls,
      visibility: normalized.value.visibility,
      stage: normalized.value.stage,
      isPinned: normalized.value.isPinned,
      publishedAt: shouldSetPublishedAt ? new Date() : existing.publishedAt,
    },
  });

  return { success: true };
}

export async function adminDeleteNewsAction(
  newsId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const existing = await prisma.news.findFirst({
    where: { id: newsId, villageId: ctx.villageId },
    select: { id: true },
  });
  if (!existing) {
    return { success: false, error: "ไม่พบข่าวนี้หรือไม่มีสิทธิ์ลบ" };
  }

  await prisma.news.delete({ where: { id: newsId } });
  return { success: true };
}

export async function adminApproveNewsSubmissionAction(
  submissionId: string,
  reviewNote?: string
): Promise<{ success: true; newsId: string } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const submission = await prisma.newsSubmission.findFirst({
    where: {
      id: submissionId,
      villageId: ctx.villageId,
      status: "PENDING",
    },
  });
  if (!submission) {
    return { success: false, error: "ไม่พบคำขอนี้หรือคำขอถูกดำเนินการแล้ว" };
  }

  const payload = submission.payload as Prisma.JsonObject;
  const parsed = normalizeNewsInput({
    title: String(payload.title ?? ""),
    summary: payload.summary ? String(payload.summary) : "",
    content: String(payload.content ?? ""),
    imageUrls: Array.isArray(payload.imageUrls)
      ? payload.imageUrls.map((value) => String(value))
      : [],
    visibility: String(payload.visibility ?? "PUBLIC"),
    stage: String(payload.stage ?? "DRAFT"),
    isPinned: Boolean(payload.isPinned),
  });
  if (!parsed.ok) {
    return { success: false, error: `ข้อมูลคำขอไม่ถูกต้อง: ${parsed.error}` };
  }

  const now = new Date();
  const reviewedBy = ctx.session.id;
  const reviewNoteValue = reviewNote?.trim() || null;

  if (submission.type === "CREATE") {
    const created = await prisma.$transaction(async (tx) => {
      const news = await tx.news.create({
        data: {
          villageId: ctx.villageId,
          title: parsed.value.title,
          summary: parsed.value.summary,
          content: parsed.value.content,
          imageUrls: parsed.value.imageUrls,
          visibility: parsed.value.visibility,
          stage: parsed.value.stage,
          isPinned: parsed.value.isPinned,
          authorId: submission.requesterId,
          publishedAt: parsed.value.stage === "PUBLISHED" ? now : null,
        },
        select: { id: true },
      });

      await tx.newsSubmission.update({
        where: { id: submission.id },
        data: {
          status: "APPROVED",
          reviewedBy,
          reviewedAt: now,
          reviewNote: reviewNoteValue,
          targetNewsId: news.id,
        },
      });

      await tx.notification.create({
        data: {
          villageId: ctx.villageId,
          userId: submission.requesterId,
          type: NotificationType.NEWS,
          title: "คำขอข่าวของคุณได้รับการอนุมัติ",
          body: `หัวข้อ: ${parsed.value.title}`,
          metadata: {
            submissionId: submission.id,
            newsId: news.id,
            status: "APPROVED",
          },
        },
      });

      return news;
    });

    return { success: true, newsId: created.id };
  }

  if (!submission.targetNewsId) {
    return { success: false, error: "คำขอแก้ไขนี้ไม่มีข่าวปลายทาง" };
  }

  const target = await prisma.news.findFirst({
    where: { id: submission.targetNewsId, villageId: ctx.villageId },
    select: { id: true, stage: true, publishedAt: true },
  });
  if (!target) {
    return { success: false, error: "ไม่พบข่าวปลายทางสำหรับคำขอนี้" };
  }

  const shouldSetPublishedAt =
    parsed.value.stage === "PUBLISHED" && (target.stage !== "PUBLISHED" || !target.publishedAt);

  await prisma.$transaction(async (tx) => {
    await tx.news.update({
      where: { id: target.id },
      data: {
        title: parsed.value.title,
        summary: parsed.value.summary,
        content: parsed.value.content,
        imageUrls: parsed.value.imageUrls,
        visibility: parsed.value.visibility,
        stage: parsed.value.stage,
        isPinned: parsed.value.isPinned,
        publishedAt: shouldSetPublishedAt ? now : target.publishedAt,
      },
    });

    await tx.newsSubmission.update({
      where: { id: submission.id },
      data: {
        status: "APPROVED",
        reviewedBy,
        reviewedAt: now,
        reviewNote: reviewNoteValue,
      },
    });

    await tx.notification.create({
      data: {
        villageId: ctx.villageId,
        userId: submission.requesterId,
        type: NotificationType.NEWS,
        title: "คำขอแก้ไขข่าวของคุณได้รับการอนุมัติ",
        body: `หัวข้อ: ${parsed.value.title}`,
        metadata: {
          submissionId: submission.id,
          newsId: target.id,
          status: "APPROVED",
        },
      },
    });
  });

  return { success: true, newsId: target.id };
}

export async function adminRejectNewsSubmissionAction(
  submissionId: string,
  reviewNote?: string
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const existing = await prisma.newsSubmission.findFirst({
    where: { id: submissionId, villageId: ctx.villageId, status: "PENDING" },
    select: { id: true, requesterId: true },
  });
  if (!existing) {
    return { success: false, error: "ไม่พบคำขอนี้หรือคำขอถูกดำเนินการแล้ว" };
  }

  await prisma.newsSubmission.update({
    where: { id: submissionId },
    data: {
      status: "REJECTED",
      reviewedBy: ctx.session.id,
      reviewedAt: new Date(),
      reviewNote: reviewNote?.trim() || null,
    },
  });

  await prisma.notification.create({
    data: {
      villageId: ctx.villageId,
      userId: existing.requesterId,
      type: NotificationType.NEWS,
      title: "คำขอข่าวของคุณไม่ได้รับการอนุมัติ",
      body: reviewNote?.trim() || "โปรดตรวจสอบหมายเหตุจากผู้ดูแล",
      metadata: {
        submissionId,
        status: "REJECTED",
      },
    },
  });

  return { success: true };
}
