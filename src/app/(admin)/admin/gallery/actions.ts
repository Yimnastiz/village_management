"use server";

import { AuditAction, NotificationType, Prisma, VillageMembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidateAdminSidebar } from "@/lib/revalidate-admin-sidebar";
import { getAdminMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { isSafeImageSource } from "@/lib/image-input";
import { deletePlaceUploads, verifyPlaceUploadToken } from "@/lib/place-upload.server";

const db = prisma;

const albumSchema = z.object({
  title: z.string().min(2, "กรุณาระบุชื่ออัลบั้ม"),
  description: z.string().optional(),
  albumDate: z.string().min(1, "กรุณาระบุวันที่อัลบั้ม"),
  isPublic: z.string().min(1, "กรุณาเลือกการมองเห็น"),
  allowResidentSubmissions: z.string().min(1, "กรุณาเลือกการรับคำขอเพิ่มรูป"),
});

const itemSchema = z.object({
  title: z.string().trim().max(500, "คำอธิบายรูปภาพยาวเกินไป").optional(),
  fileUrl: z.string().min(1, "กรุณาอัปโหลดรูปภาพ"),
  fileKey: z.string().optional(),
  uploadToken: z.string().optional(),
  mimeType: z.string().optional(),
  sortOrder: z.string().optional(),
  isCover: z.boolean().optional(),
});

type AlbumInput = z.infer<typeof albumSchema>;
type GalleryItemInput = z.infer<typeof itemSchema>;

const RESIDENT_MEMBERSHIP_ROLES: VillageMembershipRole[] = [VillageMembershipRole.RESIDENT];

async function requireAdminVillage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { ok: false as const, error: "กรุณาเข้าสู่ระบบ", villageId: "", userId: "" };
  const membership = getAdminMembership(session);
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

  const albumDate = new Date(parsed.data.albumDate);
  if (Number.isNaN(albumDate.getTime())) {
    return { ok: false as const, error: "วันที่อัลบั้มไม่ถูกต้อง" };
  }

  return {
    ok: true as const,
    value: {
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      albumDate,
      isPublic: parsed.data.isPublic === "PUBLIC",
      allowResidentSubmissions: parsed.data.allowResidentSubmissions === "ALLOW",
    },
  };
}

function isSupportedImageSource(value: string) {
  return isSafeImageSource(value);
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

  if (!isSupportedImageSource(parsed.data.fileUrl) && !(parsed.data.fileKey && parsed.data.fileUrl === galleryUploadUrl(parsed.data.fileKey))) {
    return { ok: false as const, error: "รูปภาพต้องเป็นไฟล์ที่อัปโหลดหรือ URL ที่ถูกต้อง" };
  }

  return {
    ok: true as const,
    value: {
      title: parsed.data.title?.trim() || null,
      fileUrl: parsed.data.fileUrl.trim(),
      fileKey: parsed.data.fileKey?.trim() || null,
      uploadToken: parsed.data.uploadToken?.trim() || undefined,
      mimeType: parsed.data.mimeType?.trim() || null,
      sortOrder,
      isCover: Boolean(parsed.data.isCover),
    },
  };
}

async function getResidentRecipientIds(villageId: string) {
  const residents = await prisma.villageMembership.findMany({
    where: {
      villageId,
      status: "ACTIVE",
      role: { in: RESIDENT_MEMBERSHIP_ROLES },
    },
    select: { userId: true },
    distinct: ["userId"],
  });

  return residents.map((item) => item.userId);
}

async function notifyResidents(
  villageId: string,
  title: string,
  body: string,
  metadata?: Prisma.InputJsonObject
) {
  const recipientIds = await getResidentRecipientIds(villageId);
  if (recipientIds.length === 0) return;

  await prisma.notification.createMany({
    data: recipientIds.map((userId) => ({
      userId,
      villageId,
      type: NotificationType.SYSTEM,
      title,
      body,
      ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}),
    })),
  });
}

function revalidateGalleryViews(albumId?: string, submissionId?: string) {
  revalidateAdminSidebar();
  revalidatePath("/resident/gallery");
  revalidatePath("/resident/saved");
  revalidatePath("/resident/gallery/requests");
  revalidatePath("/admin/gallery");
  revalidatePath("/resident/notifications");
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/gallery/submissions");

  if (albumId) {
    revalidatePath(`/resident/gallery/${albumId}`);
    revalidatePath(`/admin/gallery/${albumId}`);
    revalidatePath(`/admin/gallery/${albumId}/edit`);
    revalidatePath(`/admin/gallery/${albumId}/items/new`);
  }

  if (submissionId) {
    revalidatePath(`/admin/gallery/submissions/${submissionId}`);
  }
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
      albumDate: normalized.value.albumDate,
      isPublic: normalized.value.isPublic,
      allowResidentSubmissions: normalized.value.allowResidentSubmissions,
    },
    select: { id: true },
  });

  await notifyResidents(
    ctx.villageId,
    "แกลเลอรีหมู่บ้าน: มีอัลบั้มใหม่",
    `อัลบั้ม ${normalized.value.title} พร้อมให้รับชมแล้ว`,
    { albumId: created.id, actionUrl: `/resident/gallery/${created.id}` }
  );

  revalidateGalleryViews(created.id);

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
      albumDate: normalized.value.albumDate,
      isPublic: normalized.value.isPublic,
      allowResidentSubmissions: normalized.value.allowResidentSubmissions,
    },
  });

  await notifyResidents(
    ctx.villageId,
    "แกลเลอรีหมู่บ้าน: อัลบั้มถูกอัปเดต",
    `อัลบั้ม ${normalized.value.title} มีการอัปเดตข้อมูล`,
    { albumId: id, actionUrl: `/resident/gallery/${id}` }
  );

  revalidateGalleryViews(id);

  return { success: true };
}

const albumEditSchema = z.object({
  album: albumSchema,
  items: z.array(z.object({
    id: z.string().optional(), url: z.string().optional(), fileKey: z.string().optional(), uploadToken: z.string().optional(),
    description: z.string().trim().max(500).optional(), sortOrder: z.number().int().nonnegative(), isCover: z.boolean(),
  })),
});

type GalleryAlbumEditInput = z.infer<typeof albumEditSchema>;

function galleryUploadUrl(fileKey: string) {
  return `/api/places/images?key=${encodeURIComponent(fileKey)}`;
}

/** Saves album fields and the complete image draft together; removed files are released only after commit. */
export async function saveGalleryAlbumEditAction(
  albumId: string,
  data: GalleryAlbumEditInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };
  const parsed = albumEditSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง" };
  const normalizedAlbum = normalizeAlbumInput(parsed.data.album);
  if (!normalizedAlbum.ok) return { success: false, error: normalizedAlbum.error };

  const draft = [...parsed.data.items].sort((a, b) => a.sortOrder - b.sortOrder).map((item, index) => ({ ...item, sortOrder: index }));
  const hasRequestedCover = draft.some((item) => item.isCover);
  const normalizedDraft = draft.map((item, index) => ({ ...item, isCover: hasRequestedCover ? item.isCover : index === 0 }));
  const existingItems = await prisma.galleryItem.findMany({
    where: { albumId, album: { villageId: ctx.villageId } }, select: { id: true, fileUrl: true, fileKey: true },
  });
  const existingById = new Map(existingItems.map((item) => [item.id, item]));
  const seenIds = new Set<string>();
  const rows: Array<{ id?: string; fileUrl: string; fileKey: string | null; title: string | null; sortOrder: number; isCover: boolean }> = [];
  for (const item of normalizedDraft) {
    if (item.id) {
      const existing = existingById.get(item.id);
      if (!existing || seenIds.has(item.id)) return { success: false, error: "ข้อมูลรูปภาพไม่ถูกต้อง กรุณาโหลดหน้าใหม่" };
      seenIds.add(item.id);
      rows.push({ id: item.id, fileUrl: existing.fileUrl, fileKey: existing.fileKey, title: item.description?.trim() || null, sortOrder: item.sortOrder, isCover: item.isCover });
      continue;
    }
    if (!item.url || !item.fileKey || item.url !== galleryUploadUrl(item.fileKey) || !verifyPlaceUploadToken(item.uploadToken, item.fileKey, ctx.villageId)) {
      return { success: false, error: "ข้อมูลรูปภาพไม่ถูกต้อง กรุณาอัปโหลดใหม่อีกครั้ง" };
    }
    rows.push({ fileUrl: item.url, fileKey: item.fileKey, title: item.description?.trim() || null, sortOrder: item.sortOrder, isCover: item.isCover });
  }

  const removedFileKeys = existingItems.flatMap((item) => item.fileKey && !seenIds.has(item.id) ? [item.fileKey] : []);
  const saved = await prisma.$transaction(async (tx) => {
    const album = await tx.galleryAlbum.findFirst({ where: { id: albumId, villageId: ctx.villageId }, select: { id: true } });
    if (!album) return false;
    await tx.galleryAlbum.update({ where: { id: albumId }, data: normalizedAlbum.value });
    await tx.galleryItem.updateMany({ where: { albumId }, data: { isCover: false } });
    await tx.galleryItem.deleteMany({ where: { albumId, id: { notIn: [...seenIds] } } });
    for (const row of rows) {
      if (row.id) await tx.galleryItem.update({ where: { id: row.id }, data: { title: row.title, sortOrder: row.sortOrder, isCover: row.isCover } });
      else await tx.galleryItem.create({ data: { albumId, title: row.title, fileUrl: row.fileUrl, fileKey: row.fileKey, sortOrder: row.sortOrder, isCover: row.isCover } });
    }
    await tx.auditLog.create({ data: { userId: ctx.userId, villageId: ctx.villageId, action: AuditAction.UPDATE, resource: "GalleryAlbum", resourceId: albumId, metadata: { actionName: "GALLERY_ALBUM_EDIT_SAVED", imageCount: rows.length } } });
    return true;
  });
  if (!saved) return { success: false, error: "ไม่พบอัลบั้มหรือไม่มีสิทธิ์แก้ไข" };
  await deletePlaceUploads(removedFileKeys);
  revalidateGalleryViews(albumId);
  return { success: true };
}

export async function deleteGalleryAlbumAction(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const existing = await prisma.galleryAlbum.findFirst({
    where: { id, villageId: ctx.villageId },
    select: { id: true, items: { select: { fileKey: true } } },
  });
  if (!existing) return { success: false, error: "ไม่พบอัลบั้มหรือไม่มีสิทธิ์ลบ" };

  await prisma.$transaction(async (tx) => {
    await tx.savedItem.deleteMany({ where: { galleryAlbumId: id } });
    await tx.galleryAlbum.delete({ where: { id } });
  });
  await deletePlaceUploads(existing.items.flatMap((item) => item.fileKey ? [item.fileKey] : []));
  revalidateGalleryViews(id);
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
    select: { id: true, title: true },
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

  await notifyResidents(
    ctx.villageId,
    "แกลเลอรีหมู่บ้าน: มีรูปภาพใหม่",
    `อัลบั้ม ${album.title} มีรูปภาพใหม่เพิ่มเข้ามา`,
    { albumId, itemId: created.id, actionUrl: `/resident/gallery/${albumId}` }
  );

  revalidateGalleryViews(albumId);

  return { success: true, id: created.id };
}

const batchItemsSchema = z.object({
  items: z.array(z.object({ fileUrl: z.string().min(1), fileKey: z.string().optional(), uploadToken: z.string().optional(), title: z.string().trim().max(500).optional(), isCover: z.boolean().optional(), sortOrder: z.number().int().nonnegative().optional() })).min(1, "กรุณาเพิ่มรูปภาพ").max(10, "เพิ่มรูปภาพได้สูงสุด 10 รูปต่อครั้ง"),
});

export async function createGalleryItemsAction(
  albumId: string,
  data: z.infer<typeof batchItemsSchema>
): Promise<{ success: true; count: number } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };
  const parsed = batchItemsSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง" };
  const urls = parsed.data.items.map((item) => item.fileUrl.trim());
  if (!parsed.data.items.every((item) => item.fileKey && item.fileUrl.trim() === galleryUploadUrl(item.fileKey) && verifyPlaceUploadToken(item.uploadToken, item.fileKey, ctx.villageId))) return { success: false, error: "ข้อมูลรูปภาพไม่ถูกต้อง กรุณาอัปโหลดใหม่อีกครั้ง" };
  const album = await db.galleryAlbum.findFirst({ where: { id: albumId, villageId: ctx.villageId }, select: { id: true, title: true } });
  if (!album) return { success: false, error: "ไม่พบอัลบั้มหรือไม่มีสิทธิ์" };
  const latest = await db.galleryItem.aggregate({ where: { albumId }, _max: { sortOrder: true } });
  const start = (latest._max.sortOrder ?? -1) + 1;
  const requestedCover = parsed.data.items.findIndex((item) => item.isCover);
  await db.$transaction(async (tx) => {
    const hasCover = await tx.galleryItem.count({ where: { albumId, isCover: true } });
    if (requestedCover >= 0) await tx.galleryItem.updateMany({ where: { albumId }, data: { isCover: false } });
    await tx.galleryItem.createMany({ data: parsed.data.items.map((item, index) => ({ albumId, title: item.title?.trim() || null, fileUrl: urls[index], fileKey: item.fileKey!, sortOrder: start + (item.sortOrder ?? index), isCover: requestedCover >= 0 ? index === requestedCover : hasCover === 0 && index === 0 })) });
    await tx.auditLog.create({ data: { userId: ctx.userId, villageId: ctx.villageId, action: AuditAction.UPDATE, resource: "GalleryAlbum", resourceId: albumId, metadata: { actionName: "GALLERY_ITEMS_ADDED", count: parsed.data.items.length } } });
  });
  await notifyResidents(ctx.villageId, "แกลเลอรีหมู่บ้าน: มีรูปภาพใหม่", `อัลบั้ม ${album.title} มีรูปใหม่ ${parsed.data.items.length} รูป`, { albumId, actionUrl: `/resident/gallery/${albumId}` });
  revalidateGalleryViews(albumId);
  return { success: true, count: parsed.data.items.length };
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
    select: { id: true, fileKey: true, fileUrl: true },
  });
  if (!item) return { success: false, error: "ไม่พบรูปภาพนี้หรือไม่มีสิทธิ์แก้ไข" };

  const newFileKey = normalized.value.fileKey;
  const isReplacingUpload = Boolean(newFileKey && newFileKey !== item.fileKey);
  if (isReplacingUpload && (!newFileKey || !normalized.value.uploadToken || normalized.value.fileUrl !== galleryUploadUrl(newFileKey) || !verifyPlaceUploadToken(normalized.value.uploadToken, newFileKey, ctx.villageId))) return { success: false, error: "ข้อมูลรูปภาพไม่ถูกต้อง กรุณาอัปโหลดใหม่อีกครั้ง" };
  await prisma.$transaction(async (tx) => {
    if (normalized.value.isCover) await tx.galleryItem.updateMany({ where: { albumId }, data: { isCover: false } });
    await tx.galleryItem.update({ where: { id: itemId }, data: { title: normalized.value.title, fileUrl: normalized.value.fileUrl, fileKey: normalized.value.fileKey ?? item.fileKey, mimeType: normalized.value.mimeType, sortOrder: normalized.value.sortOrder, ...(normalized.value.isCover ? { isCover: true } : {}) } });
  });
  if (isReplacingUpload && item.fileKey) await deletePlaceUploads([item.fileKey]);

  revalidateGalleryViews(albumId);

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

  await prisma.$transaction(async (tx) => {
    const deleting = await tx.galleryItem.findUnique({ where: { id: itemId }, select: { isCover: true } });
    await tx.galleryItem.delete({ where: { id: itemId } });
    if (deleting?.isCover) {
      const next = await tx.galleryItem.findFirst({ where: { albumId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
      if (next) await tx.galleryItem.update({ where: { id: next.id }, data: { isCover: true } });
    }
  });
  revalidateGalleryViews(albumId);
  return { success: true };
}

export async function adminApproveGalleryItemSubmissionAction(
  submissionId: string
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

  let result: { id: string };
  try { result = await db.$transaction(async (tx) => {
    // Claim the request first so two admins cannot approve the same upload.
    const claimed = await tx.galleryItemSubmission.updateMany({
      where: { id: submission.id, status: "PENDING" },
      data: { status: "APPROVED", reviewedBy: ctx.userId, reviewedAt: new Date(), reviewNote: null },
    });
    if (claimed.count !== 1) throw new Error("SUBMISSION_ALREADY_REVIEWED");
    const latest = await tx.galleryItem.aggregate({ where: { albumId: submission.albumId }, _max: { sortOrder: true } });
    const itemCount = await tx.galleryItem.count({ where: { albumId: submission.albumId } });
    const createdItem = await tx.galleryItem.create({
      data: {
        albumId: submission.albumId,
        title: submission.title,
        fileUrl: submission.fileUrl,
        fileKey: submission.fileKey,
        mimeType: submission.mimeType,
        sortOrder: (latest._max.sortOrder ?? -1) + 1,
        isCover: itemCount === 0,
        sourceSubmissionId: submission.id,
      },
      select: { id: true },
    });

    await tx.notification.create({
      data: {
        userId: submission.requesterId,
        villageId: ctx.villageId,
        type: NotificationType.SYSTEM,
        title: "รูปภาพที่คุณส่งได้รับการอนุมัติ",
        body: `อัลบั้ม ${submission.album.title}: รูปภาพที่คุณส่งได้รับการอนุมัติแล้ว`,
        metadata: {
          actionUrl: `/resident/gallery/requests/${submission.batchId ?? submission.id}?image=${submission.id}`,
          actionLabel: "ดูคำขอเพิ่มรูป",
          submissionId: submission.id,
          status: "APPROVED",
        },
      },
    });

    return createdItem;
  }); } catch (error) {
    if (error instanceof Error && error.message === "SUBMISSION_ALREADY_REVIEWED") return { success: false, error: "คำขอนี้ถูกดำเนินการแล้ว" };
    throw error;
  }

  revalidateGalleryViews(submission.albumId, submission.id);
  revalidatePath(`/resident/gallery/requests/${submission.batchId ?? submission.id}`);
  return { success: true, itemId: result.id };
}

export async function adminRejectGalleryItemSubmissionAction(
  submissionId: string,
  reviewNote?: string
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };
  const reason = reviewNote?.trim() ?? "";
  if (reason.length < 5) return { success: false, error: "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร" };

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

  try { await db.$transaction(async (tx) => {
    const claimed = await tx.galleryItemSubmission.updateMany({ where: { id: submission.id, status: "PENDING" }, data: { status: "REJECTED", reviewedBy: ctx.userId, reviewedAt: new Date(), reviewNote: reason } });
    if (claimed.count !== 1) throw new Error("SUBMISSION_ALREADY_REVIEWED");

    await tx.notification.create({
      data: {
        userId: submission.requesterId,
        villageId: ctx.villageId,
        type: NotificationType.SYSTEM,
        title: "รูปภาพที่คุณส่งไม่ได้รับการอนุมัติ",
        body: `อัลบั้ม ${submission.album.title}: ${reason}`,
        metadata: {
          actionUrl: `/resident/gallery/requests/${submission.batchId ?? submission.id}?image=${submission.id}`,
          actionLabel: "ดูคำขอเพิ่มรูป",
          submissionId: submission.id,
          status: "REJECTED",
        },
      },
    });
  }); } catch (error) {
    if (error instanceof Error && error.message === "SUBMISSION_ALREADY_REVIEWED") return { success: false, error: "คำขอนี้ถูกดำเนินการแล้ว" };
    throw error;
  }

  revalidateGalleryViews(submission.albumId, submission.id);
  revalidatePath(`/resident/gallery/requests/${submission.batchId ?? submission.id}`);

  return { success: true };
}
