"use server";

import {
  NewsStage,
  NewsVisibility,
  NotificationType,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeVillageAuditLog } from "@/lib/audit-log";
import { revalidateAdminSidebar } from "@/lib/revalidate-admin-sidebar";
import { getAdminMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { areSafeImageSources } from "@/lib/image-input";
import { verifyPlaceUploadToken } from "@/lib/place-upload.server";
import { revalidatePath } from "next/cache";

const newsInputSchema = z.object({
  title: z.string().min(3, "กรุณาระบุหัวข้อข่าว"),
  summary: z.string().optional(),
  content: z.string().min(10, "กรุณาระบุเนื้อหาอย่างน้อย 10 ตัวอักษร"),
  images: z.array(z.object({ url: z.string().min(1), fileKey: z.string().optional(), uploadToken: z.string().optional(), fileName: z.string().optional(), sizeBytes: z.number().nonnegative().optional(), sortOrder: z.number().int().nonnegative(), isCover: z.boolean() })).max(10).optional(),
  imageUrls: z.array(z.string().min(1)).optional(),
  visibility: z.string().min(1, "กรุณาเลือกการแสดงผล"),
  stage: z.string().min(1, "กรุณาเลือกสถานะ"),
  isPinned: z.boolean().optional(),
});

type NewsInput = {
  title: string;
  summary?: string;
  content: string;
  images?: { url: string; fileKey?: string; uploadToken?: string; fileName?: string; sizeBytes?: number; sortOrder: number; isCover: boolean }[];
  imageUrls?: string[];
  visibility: string;
  stage: string;
  isPinned?: boolean;
  coverUrl?: string | null;
};

const VALID_VISIBILITY: NewsVisibility[] = ["PUBLIC", "RESIDENT_ONLY"];
const VALID_STAGE: NewsStage[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

async function requireAdminVillage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    return { ok: false as const, error: "กรุณาเข้าสู่ระบบ", session: null, villageId: "" };
  }
  const membership = getAdminMembership(session);
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

  const images = [...(parsed.data.images ?? parsed.data.imageUrls?.map((url, sortOrder) => ({ url, sortOrder, isCover: sortOrder === 0 })) ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    ok: true as const,
    value: {
      title: parsed.data.title.trim(),
      summary: parsed.data.summary?.trim() || null,
      content: parsed.data.content.trim(),
      images,
      visibility,
      stage,
      isPinned: Boolean(parsed.data.isPinned),
      coverUrl: images.find((image) => image.isCover)?.url ?? images[0]?.url ?? null,
    },
  };
}

function expectedUploadUrl(fileKey: string) { return `/api/places/images?key=${encodeURIComponent(fileKey)}`; }
function resolveNewsImages(images: { url: string; fileKey?: string; uploadToken?: string }[], villageId: string) {
  const urls: string[] = [];
  for (const image of images) {
    const url = image.url.trim();
    if (image.fileKey) {
      if (url !== expectedUploadUrl(image.fileKey) || !verifyPlaceUploadToken(image.uploadToken, image.fileKey, villageId)) return null;
    } else if (!areSafeImageSources([url]) || url.startsWith("data:")) return null;
    urls.push(url);
  }
  return urls;
}

export async function adminCreateNewsAction(
  data: NewsInput
): Promise<{ success: true; newsId: string } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalized = normalizeNewsInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };
  if (normalized.value.stage === "ARCHIVED") return { success: false, error: "ไม่สามารถสร้างข่าวเป็นเก็บถาวรได้" };
  const imageUrls = resolveNewsImages(normalized.value.images, ctx.villageId);
  if (!imageUrls) return { success: false, error: "ข้อมูลรูปภาพไม่ถูกต้อง กรุณาอัปโหลดใหม่อีกครั้ง" };

  const news = await prisma.news.create({
    data: {
      villageId: ctx.villageId,
      title: normalized.value.title,
      summary: normalized.value.summary,
      content: normalized.value.content,
      imageUrls,
      coverUrl: imageUrls.includes(normalized.value.coverUrl ?? "") ? normalized.value.coverUrl : imageUrls[0] ?? null,
      visibility: normalized.value.visibility,
      stage: normalized.value.stage,
      isPinned: normalized.value.isPinned,
      authorId: ctx.session.id,
      publishedAt: normalized.value.stage === "PUBLISHED" ? new Date() : null,
    },
  });
  await writeVillageAuditLog(prisma, { villageId: ctx.villageId, userId: ctx.session.id, action: "CREATE", resource: "News", resourceId: news.id, metadata: { actionName: "NEWS_CREATED", title: news.title, newValue: { title: news.title, stage: news.stage, visibility: news.visibility } } });
  revalidateNewsPaths(news.id);
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
  const imageUrls = resolveNewsImages(normalized.value.images, ctx.villageId);
  if (!imageUrls) return { success: false, error: "ข้อมูลรูปภาพไม่ถูกต้อง กรุณาอัปโหลดใหม่อีกครั้ง" };

  const existing = await prisma.news.findFirst({
    where: { id: newsId, villageId: ctx.villageId },
    select: { id: true, title: true, stage: true, visibility: true, publishedAt: true },
  });
  if (!existing) {
    return { success: false, error: "ไม่พบข่าวนี้หรือไม่มีสิทธิ์แก้ไข" };
  }

  await prisma.news.update({
    where: { id: newsId },
    data: {
      title: normalized.value.title,
      summary: normalized.value.summary,
      content: normalized.value.content,
      imageUrls,
      coverUrl: imageUrls.includes(normalized.value.coverUrl ?? "") ? normalized.value.coverUrl : imageUrls[0] ?? null,
      visibility: normalized.value.visibility,
      stage: existing.stage,
      isPinned: normalized.value.isPinned,
      publishedAt: existing.publishedAt,
    },
  });
  await writeVillageAuditLog(prisma, { villageId: ctx.villageId, userId: ctx.session.id, action: "UPDATE", resource: "News", resourceId: newsId, metadata: { actionName: "NEWS_UPDATED", title: normalized.value.title, oldValue: { title: existing.title, stage: existing.stage, visibility: existing.visibility }, newValue: { title: normalized.value.title, stage: normalized.value.stage, visibility: normalized.value.visibility } } });
  revalidateNewsPaths(newsId);
  return { success: true };
}

export async function adminDeleteNewsAction(
  newsId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const existing = await prisma.news.findFirst({
    where: { id: newsId, villageId: ctx.villageId },
    select: { id: true, title: true },
  });
  if (!existing) {
    return { success: false, error: "ไม่พบข่าวนี้หรือไม่มีสิทธิ์ลบ" };
  }

  await prisma.news.delete({ where: { id: newsId } });
  await writeVillageAuditLog(prisma, { villageId: ctx.villageId, userId: ctx.session.id, action: "DELETE", resource: "News", resourceId: newsId, metadata: { actionName: "NEWS_DELETED", title: existing.title } });
  revalidateNewsPaths(newsId);
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
    coverUrl: payload.coverUrl ? String(payload.coverUrl) : null,
  });
  if (!parsed.ok) {
    return { success: false, error: `ข้อมูลคำขอไม่ถูกต้อง: ${parsed.error}` };
  }

  const now = new Date();
  const reviewedBy = ctx.session.id;
  const reviewNoteValue = reviewNote?.trim() || null;

  const isDeleteRequest = Boolean(payload.isDeleteRequest);

  if (isDeleteRequest) {
    if (!submission.targetNewsId) {
      return { success: false, error: "คำขอลบนี้ไม่มีข่าวปลายทาง" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.news.delete({
        where: { id: submission.targetNewsId! },
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
          title: "คำขอลบข่าวของคุณได้รับการอนุมัติ",
          body: `หัวข้อ: ${String(payload.title ?? "")}`,
          metadata: {
            submissionId: submission.id,
            status: "APPROVED",
          },
        },
      });
      await writeVillageAuditLog(tx, { villageId: ctx.villageId, userId: ctx.session.id, action: "APPROVE", resource: "NewsSubmission", resourceId: submission.id, metadata: { actionName: "NEWS_SUBMISSION_APPROVED", title: parsed.value.title } });
    });

    revalidateAdminSidebar();
    return { success: true, newsId: submission.targetNewsId };
  }

  if (submission.type === "CREATE") {
    const created = await prisma.$transaction(async (tx) => {
      const news = await tx.news.create({
        data: {
          villageId: ctx.villageId,
          title: parsed.value.title,
          summary: parsed.value.summary,
          content: parsed.value.content,
          imageUrls: parsed.value.images.map((image) => image.url),
          coverUrl: parsed.value.coverUrl,
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
      await writeVillageAuditLog(tx, { villageId: ctx.villageId, userId: ctx.session.id, action: "APPROVE", resource: "NewsSubmission", resourceId: submission.id, metadata: { actionName: "NEWS_SUBMISSION_APPROVED", title: parsed.value.title } });

      return news;
    });

    revalidateAdminSidebar();
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
        imageUrls: parsed.value.images.map((image) => image.url),
        coverUrl: parsed.value.coverUrl,
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
    await writeVillageAuditLog(tx, { villageId: ctx.villageId, userId: ctx.session.id, action: "APPROVE", resource: "NewsSubmission", resourceId: submission.id, metadata: { actionName: "NEWS_SUBMISSION_APPROVED", title: parsed.value.title } });
  });

  revalidateAdminSidebar();
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
  await writeVillageAuditLog(prisma, { villageId: ctx.villageId, userId: ctx.session.id, action: "REJECT", resource: "NewsSubmission", resourceId: submissionId, metadata: { actionName: "NEWS_SUBMISSION_REJECTED" } });

  revalidateAdminSidebar();
  return { success: true };
}

function revalidateNewsPaths(newsId?: string) {
  ["/admin/news", "/resident/news", ...(newsId ? [`/admin/news/${newsId}`, `/resident/news/${newsId}`] : [])].forEach((path) => revalidatePath(path));
  revalidateAdminSidebar();
}

export async function adminChangeNewsStageAction(newsId: string, nextStage: "PUBLISHED" | "ARCHIVED"): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };
  const existing = await prisma.news.findFirst({ where: { id: newsId, villageId: ctx.villageId }, select: { id: true, title: true, stage: true, publishedAt: true, visibility: true } });
  if (!existing) return { success: false, error: "ไม่พบข่าวนี้" };
  const allowed = (existing.stage === "DRAFT" && nextStage === "PUBLISHED") || (existing.stage === "PUBLISHED" && nextStage === "ARCHIVED") || (existing.stage === "ARCHIVED" && nextStage === "PUBLISHED");
  if (!allowed) return { success: false, error: "ไม่สามารถเปลี่ยนสถานะข่าวนี้ได้" };
  const updated = await prisma.news.update({ where: { id: newsId }, data: { stage: nextStage, ...(nextStage === "PUBLISHED" && !existing.publishedAt ? { publishedAt: new Date() } : {}) }, select: { stage: true, publishedAt: true } });
  await writeVillageAuditLog(prisma, { villageId: ctx.villageId, userId: ctx.session.id, action: "UPDATE", resource: "News", resourceId: newsId, metadata: { actionName: nextStage === "ARCHIVED" ? "NEWS_ARCHIVED" : existing.stage === "ARCHIVED" ? "NEWS_REPUBLISHED" : "NEWS_PUBLISHED", title: existing.title, oldValue: { stage: existing.stage }, newValue: { stage: updated.stage, publishedAt: updated.publishedAt, visibility: existing.visibility } } });
  revalidateNewsPaths(newsId);
  return { success: true };
}
