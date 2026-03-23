"use server";

import { NotificationType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";

const db = prisma as any;

const albumSchema = z.object({
  title: z.string().min(2, "กรุณาระบุชื่ออัลบั้ม"),
  description: z.string().optional(),
  coverUrl: z.string().url("URL รูปหน้าปกไม่ถูกต้อง").optional().or(z.literal("")),
  isPublic: z.string().min(1, "กรุณาเลือกการมองเห็น"),
  allowResidentSubmissions: z.string().min(1, "กรุณาเลือกการรับคำขอเพิ่มรูป"),
});

const itemSchema = z.object({
  title: z.string().optional(),
  fileUrl: z.string().url("URL รูปภาพไม่ถูกต้อง"),
  mimeType: z.string().optional(),
  sortOrder: z.string().optional(),
});

type AlbumInput = z.infer<typeof albumSchema>;
type GalleryItemInput = z.infer<typeof itemSchema>;

async function requireAdminVillage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { ok: false as const, error: "กรุณาเข้าสู่ระบบ", villageId: "", userId: "" };
  if (!isAdminUser(session)) return { ok: false as const, error: "ไม่มีสิทธิ์ดำเนินการ", villageId: "", userId: "" };

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) return { ok: false as const, error: "ไม่พบหมู่บ้านของคุณ", villageId: "", userId: "" };

  return { ok: true as const, error: null, villageId: membership.villageId, userId: session.id };
}

function normalizeAlbumInput(data: AlbumInput) {
  const parsed = albumSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง",
    };
  }

  return {
    ok: true as const,
    value: {
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      coverUrl: parsed.data.coverUrl?.trim() || null,
      isPublic: parsed.data.isPublic === "PUBLIC",
      allowResidentSubmissions: parsed.data.allowResidentSubmissions === "ALLOW",
    },
  };
}

function normalizeItemInput(data: GalleryItemInput) {
  const parsed = itemSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง",
    };
  }

  const sortOrderRaw = parsed.data.sortOrder?.trim();
  const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : 0;
  if (Number.isNaN(sortOrder)) {
    return { ok: false as const, error: "ลำดับการแสดงผลไม่ถูกต้อง" };
  }

  return {
    ok: true as const,
    value: {
      title: parsed.data.title?.trim() || null,
      fileUrl: parsed.data.fileUrl.trim(),
      mimeType: parsed.data.mimeType?.trim() || null,
      sortOrder,
    },
  };
}

export async function createGalleryAlbumAction(
  data: AlbumInput
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalized = normalizeAlbumInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const created = await db.galleryAlbum.create({
    data: {
      villageId: ctx.villageId,
      title: normalized.value.title,
      description: normalized.value.description,
      coverUrl: normalized.value.coverUrl,
      isPublic: normalized.value.isPublic,
      allowResidentSubmissions: normalized.value.allowResidentSubmissions,
    },
    select: { id: true },
  });

  return { success: true, id: created.id };
}

export async function updateGalleryAlbumAction(
  id: string,
  data: AlbumInput
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalized = normalizeAlbumInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const existing = await db.galleryAlbum.findFirst({
    where: { id, villageId: ctx.villageId },
    select: { id: true },
  });
  if (!existing) return { success: false, error: "ไม่พบอัลบั้มหรือไม่มีสิทธิ์แก้ไข" };

  await db.galleryAlbum.update({
    where: { id },
    data: {
      title: normalized.value.title,
      description: normalized.value.description,
      coverUrl: normalized.value.coverUrl,
      isPublic: normalized.value.isPublic,
      allowResidentSubmissions: normalized.value.allowResidentSubmissions,
    },
  });

  return { success: true };
}

export async function deleteGalleryAlbumAction(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const existing = await prisma.galleryAlbum.findFirst({
    where: { id, villageId: ctx.villageId },
    select: { id: true },
  });
  if (!existing) return { success: false, error: "ไม่พบอัลบั้มหรือไม่มีสิทธิ์ลบ" };

  await prisma.galleryAlbum.delete({ where: { id } });
  return { success: true };
}

export async function createGalleryItemAction(
  albumId: string,
  data: GalleryItemInput
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalized = normalizeItemInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const album = await prisma.galleryAlbum.findFirst({
    where: { id: albumId, villageId: ctx.villageId },
    select: { id: true },
  });
  if (!album) return { success: false, error: "ไม่พบอัลบั้มนี้" };

  const created = await prisma.galleryItem.create({
    data: {
      albumId,
      title: normalized.value.title,
      fileUrl: normalized.value.fileUrl,
      mimeType: normalized.value.mimeType,
      sortOrder: normalized.value.sortOrder,
    },
    select: { id: true },
  });

  return { success: true, id: created.id };
}

export async function updateGalleryItemAction(
  albumId: string,
  itemId: string,
  data: GalleryItemInput
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalized = normalizeItemInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const item = await prisma.galleryItem.findFirst({
    where: { id: itemId, albumId, album: { villageId: ctx.villageId } },
    select: { id: true },
  });
  if (!item) return { success: false, error: "ไม่พบรูปภาพนี้หรือไม่มีสิทธิ์แก้ไข" };

  await prisma.galleryItem.update({
    where: { id: itemId },
    data: {
      title: normalized.value.title,
      fileUrl: normalized.value.fileUrl,
      mimeType: normalized.value.mimeType,
      sortOrder: normalized.value.sortOrder,
    },
  });

  return { success: true };
}

export async function deleteGalleryItemAction(
  albumId: string,
  itemId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const item = await prisma.galleryItem.findFirst({
    where: { id: itemId, albumId, album: { villageId: ctx.villageId } },
    select: { id: true },
  });
  if (!item) return { success: false, error: "ไม่พบรูปภาพนี้หรือไม่มีสิทธิ์ลบ" };

  await prisma.galleryItem.delete({ where: { id: itemId } });
  return { success: true };
}

export async function adminApproveGalleryItemSubmissionAction(
  submissionId: string,
  reviewNote?: string
): Promise<{ success: true; itemId: string } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const submission = await db.galleryItemSubmission.findFirst({
    where: {
      id: submissionId,
      status: "PENDING",
      album: { villageId: ctx.villageId },
    },
    include: {
      album: {
        select: {
          id: true,
          title: true,
          allowResidentSubmissions: true,
        },
      },
    },
  });

  if (!submission) {
    return { success: false, error: "ไม่พบคำขอหรือคำขอถูกดำเนินการแล้ว" };
  }

  const result = await db.$transaction(async (tx: any) => {
    const createdItem = await tx.galleryItem.create({
      data: {
        albumId: submission.albumId,
        title: submission.title,
        fileUrl: submission.fileUrl,
        mimeType: submission.mimeType,
        sortOrder: 0,
      },
      select: { id: true },
    });

    await tx.galleryItemSubmission.update({
      where: { id: submission.id },
      data: {
        status: "APPROVED",
        reviewedBy: ctx.userId,
        reviewedAt: new Date(),
        reviewNote: reviewNote?.trim() || null,
      },
    });

    await tx.notification.create({
      data: {
        userId: submission.requesterId,
        villageId: ctx.villageId,
        type: NotificationType.SYSTEM,
        title: "คำขอเพิ่มรูปภาพได้รับการอนุมัติ",
        body: `อัลบั้ม ${submission.album.title}: รูปภาพของคุณได้รับการอนุมัติแล้ว`,
        metadata: {
          actionUrl: `/resident/gallery/${submission.albumId}`,
          actionLabel: "ดูอัลบั้ม",
          submissionId: submission.id,
          status: "APPROVED",
        },
      },
    });

    return createdItem;
  });

  return { success: true, itemId: result.id };
}

export async function adminRejectGalleryItemSubmissionAction(
  submissionId: string,
  reviewNote?: string
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const submission = await db.galleryItemSubmission.findFirst({
    where: {
      id: submissionId,
      status: "PENDING",
      album: { villageId: ctx.villageId },
    },
    include: {
      album: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  if (!submission) {
    return { success: false, error: "ไม่พบคำขอหรือคำขอถูกดำเนินการแล้ว" };
  }

  await db.$transaction(async (tx: any) => {
    await tx.galleryItemSubmission.update({
      where: { id: submission.id },
      data: {
        status: "REJECTED",
        reviewedBy: ctx.userId,
        reviewedAt: new Date(),
        reviewNote: reviewNote?.trim() || "ไม่ผ่านเงื่อนไขการอนุมัติ",
      },
    });

    await tx.notification.create({
      data: {
        userId: submission.requesterId,
        villageId: ctx.villageId,
        type: NotificationType.SYSTEM,
        title: "คำขอเพิ่มรูปภาพไม่ผ่านการอนุมัติ",
        body: `อัลบั้ม ${submission.album.title}: ${reviewNote?.trim() || "โปรดแก้ไขและส่งใหม่"}`,
        metadata: {
          actionUrl: `/resident/gallery/${submission.albumId}/request`,
          actionLabel: "ส่งคำขอใหม่",
          submissionId: submission.id,
          status: "REJECTED",
        },
      },
    });
  });

  return { success: true };
}
