"use server";

import { AuditAction, IssueStage, NotificationType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminActionSession } from "@/lib/superadmin";
import { SUPERADMIN_ISSUE_MESSAGE_SENDER_ID } from "@/lib/superadmin-auth";
import { notifyVillageAdministrationOfSuperAdminIntervention } from "@/lib/superadmin-village-intervention";
import { requireSupportReason } from "@/features/village-public-content/server/context";
import { deletePlaceUploads, verifyPlaceUploadToken } from "@/lib/place-upload.server";
import { z } from "zod";
import { getIssueUserStatus, ISSUE_ALLOWED_TRANSITIONS, ISSUE_STATUS_META, ISSUE_USER_STATUS_TO_STAGE, type IssueUserStatus } from "@/lib/issues/status";
import { ActionReasonError, requireActionReason } from "@/lib/sensitive-action-policy";
import { notificationMetadata } from "@/lib/notification-copy";

type Result = { success: true; message: string } | { success: false; error: string };

const superAdminAlbumSchema = z.object({ title: z.string().trim().min(2), description: z.string().optional(), albumDate: z.string().min(1), isPublic: z.enum(["PUBLIC", "RESIDENT"]), allowResidentSubmissions: z.enum(["ALLOW", "DISALLOW"]) });
const superAdminItemSchema = z.object({ id: z.string().optional(), url: z.string().optional(), fileKey: z.string().optional(), uploadToken: z.string().optional(), description: z.string().trim().max(500).optional(), sortOrder: z.number().int().nonnegative(), isCover: z.boolean() });
type SuperAdminAlbumInput = z.infer<typeof superAdminAlbumSchema>;
type SuperAdminItemInput = z.infer<typeof superAdminItemSchema>;

function galleryUrl(fileKey: string) { return `/api/places/images?key=${encodeURIComponent(fileKey)}`; }
function parseSuperAdminAlbum(data: SuperAdminAlbumInput) {
  const parsed = superAdminAlbumSchema.safeParse(data);
  if (!parsed.success) return { ok: false as const, error: "ข้อมูลอัลบั้มไม่ถูกต้อง" };
  const albumDate = new Date(parsed.data.albumDate);
  if (Number.isNaN(albumDate.getTime())) return { ok: false as const, error: "วันที่อัลบั้มไม่ถูกต้อง" };
  return { ok: true as const, value: { title: parsed.data.title.trim(), description: parsed.data.description?.trim() || null, albumDate, isPublic: parsed.data.isPublic === "PUBLIC", allowResidentSubmissions: parsed.data.allowResidentSubmissions === "ALLOW" } };
}

function parseGallerySupportReason(value: unknown) { try { return { ok: true as const, value: requireSupportReason(typeof value === "string" ? value : undefined) }; } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "เหตุผลไม่ถูกต้อง" }; } }

function reason(input: unknown) {
  return requireSupportReason(typeof input === "string" ? input : undefined);
}

async function village(villageId: string) {
  await requireSuperAdminActionSession();
  const row = await prisma.village.findUnique({ where: { id: villageId }, select: { id: true } });
  if (!row) throw new Error("ไม่พบหมู่บ้านเป้าหมาย");
  return row;
}

function refresh(villageId: string, module: "issues" | "appointments", id: string) {
  revalidatePath(`/superadmin/villages/${villageId}/${module}`);
  revalidatePath(`/superadmin/villages/${villageId}/${module}/${id}`);
  revalidatePath(`/superadmin/villages/${villageId}/overview`);
  revalidatePath(`/superadmin/villages/${villageId}/audit`);
  revalidatePath(`/resident/${module}`);
  revalidatePath(`/resident/${module}/${id}`);
  revalidatePath("/resident/notifications");
}

async function notifyResidents(villageId: string, title: string, body: string, metadata: Prisma.InputJsonValue) {
  const recipients = await prisma.villageMembership.findMany({
    where: { villageId, status: "ACTIVE", role: "RESIDENT" },
    select: { userId: true }, distinct: ["userId"],
  });
  if (!recipients.length) return;
  await prisma.notification.createMany({ data: recipients.map(({ userId }) => ({
    villageId, userId, type: NotificationType.SYSTEM, title, body, metadata,
  })) });
}

function refreshWorkspace(villageId: string, module: string, id?: string) {
  revalidatePath(`/superadmin/villages/${villageId}/${module}`);
  revalidatePath(`/superadmin/villages/${villageId}/overview`);
  revalidatePath(`/superadmin/villages/${villageId}/audit`);
  revalidatePath(`/resident/${module}`);
  revalidatePath("/resident/notifications");
  if (id) {
    revalidatePath(`/superadmin/villages/${villageId}/${module}/${id}`);
    revalidatePath(`/resident/${module}/${id}`);
  }
}

async function saveSuperAdminGalleryAlbumResultAction(villageId: string, formData: FormData): Promise<Result> {
  try {
    await village(villageId);
    const supportReason = reason(formData.get("supportReason"));
    const id = String(formData.get("albumId") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim() || null;
    const albumDate = new Date(String(formData.get("albumDate") ?? ""));
    if (title.length < 2 || Number.isNaN(albumDate.getTime())) return { success: false, error: "ข้อมูลอัลบั้มไม่ถูกต้อง" };
    const data = { title, description, albumDate, isPublic: formData.get("isPublic") === "on", allowResidentSubmissions: formData.get("allowResidentSubmissions") === "on" };
    const existing = id ? await prisma.galleryAlbum.findFirst({ where: { id, villageId }, select: { id: true } }) : null;
    if (id && !existing) return { success: false, error: "ไม่พบอัลบั้มในหมู่บ้านนี้" };
    const album = existing
      ? await prisma.galleryAlbum.update({ where: { id: existing.id }, data })
      : await prisma.galleryAlbum.create({ data: { villageId, ...data } });
    await prisma.auditLog.create({ data: { userId: null, villageId, action: id ? AuditAction.UPDATE : AuditAction.CREATE, resource: "GalleryAlbum", resourceId: album.id, metadata: { actorRole: "SUPERADMIN", actorType: "SUPERADMIN_ENV", actionName: id ? "GALLERY_ALBUM_UPDATED" : "GALLERY_ALBUM_CREATED", supportReason } } });
    await prisma.$transaction((tx) => notifyVillageAdministrationOfSuperAdminIntervention(tx, { villageId, actionLabel: id ? "แก้ไขอัลบั้มภาพ" : "เพิ่มอัลบั้มภาพ", supportReason, targetType: "GalleryAlbum", targetId: album.id, targetName: title, actionUrl: `/admin/gallery/${album.id}`, metadata: { albumId: album.id } }));
    if (!id) await notifyResidents(villageId, "แกลเลอรีหมู่บ้าน: มีอัลบั้มใหม่", `อัลบั้ม ${title} พร้อมให้รับชมแล้ว`, { source: "GALLERY", albumId: album.id, actionUrl: `/resident/gallery/${album.id}` });
    refreshWorkspace(villageId, "gallery", album.id);
    return { success: true, message: "บันทึกอัลบั้มแล้ว" };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "ไม่สามารถบันทึกอัลบั้มได้" }; }
}

async function deleteSuperAdminGalleryAlbumResultAction(villageId: string, albumId: string, formData: FormData): Promise<Result> {
  try {
    await village(villageId); const supportReason = reason(formData.get("supportReason"));
    const album = await prisma.galleryAlbum.findFirst({ where: { id: albumId, villageId }, select: { id: true, title: true } });
    if (!album) return { success: false, error: "ไม่พบอัลบั้มในหมู่บ้านนี้" };
    await prisma.$transaction(async (tx) => {
      await tx.savedItem.deleteMany({ where: { galleryAlbumId: album.id } });
      await tx.galleryAlbum.delete({ where: { id: album.id } });
      await tx.auditLog.create({ data: { userId: null, villageId, action: AuditAction.DELETE, resource: "GalleryAlbum", resourceId: album.id, metadata: { actorRole: "SUPERADMIN", actorType: "SUPERADMIN_ENV", actionName: "GALLERY_ALBUM_DELETED", supportReason, title: album.title } } });
      await notifyVillageAdministrationOfSuperAdminIntervention(tx, { villageId, actionLabel: "ลบอัลบั้มภาพ", supportReason, targetType: "GalleryAlbum", targetId: album.id, targetName: album.title, actionUrl: "/admin/gallery", metadata: { albumId: album.id } });
    });
    refreshWorkspace(villageId, "gallery"); return { success: true, message: "ลบอัลบั้มแล้ว" };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "ไม่สามารถลบอัลบั้มได้" }; }
}

async function reviewSuperAdminGallerySubmissionResultAction(villageId: string, submissionId: string, formData: FormData): Promise<Result> {
  try {
    await village(villageId); const supportReason = reason(formData.get("supportReason"));
    const decision = String(formData.get("decision") ?? "");
    const businessReason = String(formData.get("businessReason") ?? "").trim();
    const submission = await prisma.galleryItemSubmission.findFirst({ where: { id: submissionId, status: "PENDING", album: { villageId } }, include: { album: { select: { id: true, villageId: true, title: true } } } });
    if (!submission || (decision !== "APPROVE" && decision !== "REJECT")) return { success: false, error: "ไม่พบคำขอหรือคำสั่งไม่ถูกต้อง" };
    if (decision === "REJECT" && (businessReason.length < 5 || businessReason.length > 500)) return { success: false, error: "กรุณาระบุเหตุผลที่ไม่อนุมัติ 5–500 ตัวอักษร" };
    await prisma.$transaction(async (tx) => {
      let itemId: string | null = null;
      if (decision === "APPROVE") {
        const count = await tx.galleryItem.count({ where: { albumId: submission.albumId } });
        const item = await tx.galleryItem.create({ data: { albumId: submission.albumId, title: submission.title, fileUrl: submission.fileUrl, fileKey: submission.fileKey, mimeType: submission.mimeType, sortOrder: count, isCover: count === 0, sourceSubmissionId: submission.id } });
        itemId = item.id;
        if (count === 0) await tx.galleryAlbum.update({ where: { id: submission.albumId }, data: { coverUrl: submission.fileUrl } });
      }
      await tx.galleryItemSubmission.update({ where: { id: submission.id }, data: { status: decision === "APPROVE" ? "APPROVED" : "REJECTED", reviewedBy: null, reviewedAt: new Date(), reviewNote: decision === "REJECT" ? businessReason : null } });
      await tx.notification.create({ data: { villageId, userId: submission.requesterId, type: NotificationType.SYSTEM, title: decision === "APPROVE" ? "รูปภาพได้รับการอนุมัติ" : "รูปภาพไม่ได้รับการอนุมัติ", body: decision === "APPROVE" ? `รูปภาพถูกเพิ่มในอัลบั้ม ${submission.album.title}` : `เหตุผล: ${businessReason}`, metadata: { source: "GALLERY", submissionId: submission.id, albumId: submission.albumId, itemId, status: decision === "APPROVE" ? "APPROVED" : "REJECTED" } } });
      await tx.auditLog.create({ data: { userId: null, villageId, action: decision === "APPROVE" ? AuditAction.APPROVE : AuditAction.REJECT, resource: "GalleryItemSubmission", resourceId: submission.id, metadata: { actorRole: "SUPERADMIN", actorType: "SUPERADMIN_ENV", actionName: `GALLERY_SUBMISSION_${decision}D`, supportReason, businessReason: decision === "REJECT" ? businessReason : null, albumId: submission.albumId, requesterId: submission.requesterId, itemId } } });
      await notifyVillageAdministrationOfSuperAdminIntervention(tx, { villageId, actionLabel: decision === "APPROVE" ? "อนุมัติรูปภาพที่ส่งเข้าร่วม" : "ปฏิเสธรูปภาพที่ส่งเข้าร่วม", supportReason, targetType: "GalleryItemSubmission", targetId: submission.id, targetName: submission.album.title, actionUrl: `/admin/gallery/submissions/${submission.id}`, metadata: { submissionId: submission.id, albumId: submission.albumId } });
    });
    refreshWorkspace(villageId, "gallery", submission.albumId); return { success: true, message: "บันทึกผลการพิจารณาแล้ว" };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "ไม่สามารถพิจารณาคำขอได้" }; }
}

export async function saveSuperAdminGalleryAlbumDataAction(villageId: string, albumId: string | null, data: SuperAdminAlbumInput, items: SuperAdminItemInput[], supportReasonInput: string): Promise<Result & { id?: string }> {
  try {
    await village(villageId);
    const support = parseGallerySupportReason(supportReasonInput);
    if (!support.ok) return support;
    const parsed = parseSuperAdminAlbum(data);
    if (!parsed.ok) return parsed;
    const normalizedItems = items.map((item, index) => ({ ...item, sortOrder: index }));
    const existing = albumId ? await prisma.galleryAlbum.findFirst({ where: { id: albumId, villageId }, include: { items: { select: { id: true, fileKey: true, fileUrl: true } } } }) : null;
    if (albumId && !existing) return { success: false, error: "ไม่พบอัลบั้มในหมู่บ้านนี้" };
    const existingById = new Map((existing?.items ?? []).map((item) => [item.id, item]));
    const seen = new Set<string>();
    const rows: Array<{ id?: string; fileUrl: string; fileKey: string | null; title: string | null; sortOrder: number; isCover: boolean }> = [];
    for (const item of normalizedItems) {
      if (item.id) {
        const old = existingById.get(item.id);
        if (!old || seen.has(item.id)) return { success: false, error: "พบรูปภาพที่ไม่อยู่ในอัลบั้มนี้" };
        seen.add(item.id); rows.push({ id: item.id, fileUrl: old.fileUrl, fileKey: old.fileKey, title: item.description?.trim() || null, sortOrder: item.sortOrder, isCover: item.isCover });
      } else {
        if (!item.url || !item.fileKey || item.url !== galleryUrl(item.fileKey) || !verifyPlaceUploadToken(item.uploadToken, item.fileKey, villageId)) return { success: false, error: "ข้อมูลรูปภาพอัปโหลดไม่ถูกต้อง" };
        rows.push({ fileUrl: item.url, fileKey: item.fileKey, title: item.description?.trim() || null, sortOrder: item.sortOrder, isCover: item.isCover });
      }
    }
    const hasCover = rows.some((row) => row.isCover);
    const finalRows = rows.map((row, index) => ({ ...row, isCover: hasCover ? row.isCover : index === 0 }));
    const removed = (existing?.items ?? []).flatMap((item) => item.fileKey && !seen.has(item.id) ? [item.fileKey] : []);
    let savedId = albumId ?? "";
    await prisma.$transaction(async (tx) => {
      const album = existing ? await tx.galleryAlbum.update({ where: { id: existing.id }, data: parsed.value, select: { id: true, title: true } }) : await tx.galleryAlbum.create({ data: { villageId, ...parsed.value }, select: { id: true, title: true } });
      savedId = album.id;
      if (existing) {
        await tx.galleryItem.updateMany({ where: { albumId: album.id }, data: { isCover: false } });
        await tx.galleryItem.deleteMany({ where: { albumId: album.id, id: { notIn: [...seen] } } });
      }
      for (const row of finalRows) {
        if (row.id) await tx.galleryItem.update({ where: { id: row.id }, data: { title: row.title, sortOrder: row.sortOrder, isCover: row.isCover } });
        else await tx.galleryItem.create({ data: { albumId: album.id, fileUrl: row.fileUrl, fileKey: row.fileKey, title: row.title, sortOrder: row.sortOrder, isCover: row.isCover } });
      }
      await tx.auditLog.create({ data: { userId: null, villageId, action: existing ? AuditAction.UPDATE : AuditAction.CREATE, resource: "GalleryAlbum", resourceId: album.id, metadata: { actorRole: "SUPERADMIN", actorType: "SUPERADMIN_ENV", actionName: existing ? "GALLERY_ALBUM_UPDATED" : "GALLERY_ALBUM_CREATED", supportReason: support.value, imageCount: finalRows.length } } });
      await notifyVillageAdministrationOfSuperAdminIntervention(tx, { villageId, actionLabel: existing ? "แก้ไขอัลบั้มภาพ" : "เพิ่มอัลบั้มภาพ", supportReason: support.value, targetType: "GalleryAlbum", targetId: album.id, targetName: album.title, actionUrl: `/admin/gallery/${album.id}`, metadata: { source: "GALLERY", albumId: album.id } });
    });
    await deletePlaceUploads(removed);
    if (!existing) await notifyResidents(villageId, "แกลเลอรีหมู่บ้าน: มีอัลบั้มใหม่", `อัลบั้ม ${parsed.value.title} พร้อมให้รับชมแล้ว`, { source: "GALLERY", albumId: savedId, actionUrl: `/resident/gallery/${savedId}` });
    refreshWorkspace(villageId, "gallery", savedId);
    return { success: true, message: existing ? "บันทึกการแก้ไขแล้ว" : "สร้างอัลบั้มแล้ว", id: savedId };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "ไม่สามารถบันทึกอัลบั้มได้" }; }
}

export async function addSuperAdminGalleryItemsDataAction(villageId: string, albumId: string, items: SuperAdminItemInput[], supportReasonInput: string): Promise<Result & { count?: number }> {
  try {
    await village(villageId); const support = parseGallerySupportReason(supportReasonInput); if (!support.ok) return support;
    const album = await prisma.galleryAlbum.findFirst({ where: { id: albumId, villageId }, select: { id: true, title: true } });
    if (!album) return { success: false, error: "ไม่พบอัลบั้มในหมู่บ้านนี้" };
    if (!items.length || items.length > 10) return { success: false, error: "จำนวนรูปภาพไม่ถูกต้อง" };
    if (!items.every((item) => item.url && item.fileKey && item.url === galleryUrl(item.fileKey) && verifyPlaceUploadToken(item.uploadToken, item.fileKey, villageId))) return { success: false, error: "ข้อมูลรูปภาพอัปโหลดไม่ถูกต้อง" };
    await prisma.$transaction(async (tx) => {
      const latest = await tx.galleryItem.aggregate({ where: { albumId }, _max: { sortOrder: true } });
      const count = await tx.galleryItem.count({ where: { albumId } });
      const coverIndex = items.findIndex((item) => item.isCover);
      if (coverIndex >= 0) await tx.galleryItem.updateMany({ where: { albumId }, data: { isCover: false } });
      await tx.galleryItem.createMany({ data: items.map((item, index) => ({ albumId, fileUrl: item.url!, fileKey: item.fileKey!, title: item.description?.trim() || null, sortOrder: (latest._max.sortOrder ?? -1) + index + 1, isCover: coverIndex >= 0 ? index === coverIndex : count === 0 && index === 0 })) });
      await tx.auditLog.create({ data: { userId: null, villageId, action: AuditAction.UPDATE, resource: "GalleryAlbum", resourceId: albumId, metadata: { actorRole: "SUPERADMIN", actorType: "SUPERADMIN_ENV", actionName: "GALLERY_ITEMS_ADDED", supportReason: support.value, count: items.length } } });
      await notifyVillageAdministrationOfSuperAdminIntervention(tx, { villageId, actionLabel: "เพิ่มรูปภาพ", supportReason: support.value, targetType: "GalleryAlbum", targetId: albumId, targetName: album.title, actionUrl: `/admin/gallery/${albumId}`, metadata: { source: "GALLERY", albumId, count: items.length } });
    });
    await notifyResidents(villageId, "แกลเลอรีหมู่บ้าน: มีรูปภาพใหม่", `อัลบั้ม ${album.title} มีรูปภาพใหม่ ${items.length} รูป`, { source: "GALLERY", albumId, actionUrl: `/resident/gallery/${albumId}` });
    refreshWorkspace(villageId, "gallery", albumId); return { success: true, message: "เพิ่มรูปภาพแล้ว", count: items.length };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "ไม่สามารถเพิ่มรูปภาพได้" }; }
}

export async function updateSuperAdminGalleryItemDataAction(villageId: string, albumId: string, itemId: string, item: SuperAdminItemInput, supportReasonInput: string): Promise<Result> {
  try {
    await village(villageId); const support = parseGallerySupportReason(supportReasonInput); if (!support.ok) return support;
    const row = await prisma.galleryItem.findFirst({ where: { id: itemId, albumId, album: { villageId } }, select: { id: true, fileKey: true, fileUrl: true, title: true, album: { select: { title: true } } } });
    if (!row) return { success: false, error: "ไม่พบรูปภาพในอัลบั้มของหมู่บ้านนี้" };
    if (item.fileKey && item.fileKey !== row.fileKey && (!item.url || item.url !== galleryUrl(item.fileKey) || !verifyPlaceUploadToken(item.uploadToken, item.fileKey, villageId))) return { success: false, error: "ข้อมูลรูปภาพอัปโหลดไม่ถูกต้อง" };
    await prisma.$transaction(async (tx) => {
      if (item.isCover) await tx.galleryItem.updateMany({ where: { albumId }, data: { isCover: false } });
      await tx.galleryItem.update({ where: { id: itemId }, data: { title: item.description?.trim() || null, sortOrder: item.sortOrder, isCover: item.isCover, ...(item.fileKey && item.fileKey !== row.fileKey ? { fileKey: item.fileKey, fileUrl: item.url } : {}) } });
      await tx.auditLog.create({ data: { userId: null, villageId, action: AuditAction.UPDATE, resource: "GalleryItem", resourceId: itemId, metadata: { actorRole: "SUPERADMIN", actorType: "SUPERADMIN_ENV", actionName: "GALLERY_ITEM_UPDATED", supportReason: support.value, albumId } } });
      await notifyVillageAdministrationOfSuperAdminIntervention(tx, { villageId, actionLabel: "แก้ไขรูปภาพ", supportReason: support.value, targetType: "GalleryItem", targetId: itemId, targetName: row.album.title, actionUrl: `/admin/gallery/${albumId}`, metadata: { source: "GALLERY", albumId, itemId } });
    });
    if (item.fileKey && item.fileKey !== row.fileKey && row.fileKey) await deletePlaceUploads([row.fileKey]);
    refreshWorkspace(villageId, "gallery", albumId); return { success: true, message: "บันทึกการแก้ไขแล้ว" };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "ไม่สามารถแก้ไขรูปภาพได้" }; }
}

export async function deleteSuperAdminGalleryItemDataAction(villageId: string, albumId: string, itemId: string, supportReasonInput: string): Promise<Result> {
  try {
    await village(villageId); const support = parseGallerySupportReason(supportReasonInput); if (!support.ok) return support;
    const row = await prisma.galleryItem.findFirst({ where: { id: itemId, albumId, album: { villageId } }, select: { id: true, fileKey: true, isCover: true, title: true, album: { select: { title: true } } } });
    if (!row) return { success: false, error: "ไม่พบรูปภาพในอัลบั้มของหมู่บ้านนี้" };
    await prisma.$transaction(async (tx) => { await tx.galleryItem.delete({ where: { id: itemId } }); if (row.isCover) { const next = await tx.galleryItem.findFirst({ where: { albumId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } }); if (next) await tx.galleryItem.update({ where: { id: next.id }, data: { isCover: true } }); } await tx.auditLog.create({ data: { userId: null, villageId, action: AuditAction.DELETE, resource: "GalleryItem", resourceId: itemId, metadata: { actorRole: "SUPERADMIN", actorType: "SUPERADMIN_ENV", actionName: "GALLERY_ITEM_DELETED", supportReason: support.value, albumId } } }); await notifyVillageAdministrationOfSuperAdminIntervention(tx, { villageId, actionLabel: "ลบรูปภาพ", supportReason: support.value, targetType: "GalleryItem", targetId: itemId, targetName: row.album.title, actionUrl: `/admin/gallery/${albumId}`, metadata: { source: "GALLERY", albumId, itemId } }); });
    if (row.fileKey) await deletePlaceUploads([row.fileKey]); refreshWorkspace(villageId, "gallery", albumId); return { success: true, message: "ลบรูปภาพแล้ว" };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "ไม่สามารถลบรูปภาพได้" }; }
}

export async function reviewSuperAdminGallerySubmissionDataAction(villageId: string, submissionId: string, decision: "APPROVE" | "REJECT", businessReasonInput: string, supportReasonInput: string): Promise<Result> {
  try {
    await village(villageId); const support = parseGallerySupportReason(supportReasonInput); if (!support.ok) return support;
    const businessReason = businessReasonInput.trim();
    if (decision === "REJECT" && (businessReason.length < 5 || businessReason.length > 500)) return { success: false, error: "กรุณาระบุเหตุผลปฏิเสธ 5–500 ตัวอักษร" };
    const submission = await prisma.galleryItemSubmission.findFirst({ where: { id: submissionId, status: "PENDING", album: { villageId } }, include: { album: { select: { id: true, title: true } } } });
    if (!submission) return { success: false, error: "ไม่พบคำขอในหมู่บ้านนี้ หรือคำขอถูกดำเนินการแล้ว" };
    await prisma.$transaction(async (tx) => {
      let itemId: string | null = null;
      if (decision === "APPROVE") { const count = await tx.galleryItem.count({ where: { albumId: submission.albumId } }); const item = await tx.galleryItem.create({ data: { albumId: submission.albumId, title: submission.title, fileUrl: submission.fileUrl, fileKey: submission.fileKey, mimeType: submission.mimeType, sortOrder: count, isCover: count === 0, sourceSubmissionId: submission.id }, select: { id: true } }); itemId = item.id; }
      const claimed = await tx.galleryItemSubmission.updateMany({ where: { id: submission.id, status: "PENDING" }, data: { status: decision === "APPROVE" ? "APPROVED" : "REJECTED", reviewedBy: null, reviewedAt: new Date(), reviewNote: decision === "REJECT" ? businessReason : null } });
      if (claimed.count !== 1) throw new Error("SUBMISSION_ALREADY_REVIEWED");
      await tx.notification.create({ data: { villageId, userId: submission.requesterId, type: NotificationType.SYSTEM, title: decision === "APPROVE" ? "รูปภาพได้รับการอนุมัติ" : "รูปภาพไม่ได้รับการอนุมัติ", body: decision === "APPROVE" ? `อัลบั้ม ${submission.album.title}: รูปภาพที่คุณส่งได้รับการอนุมัติแล้ว` : `อัลบั้ม ${submission.album.title}: ${businessReason}`, metadata: { source: "GALLERY", submissionId: submission.id, albumId: submission.albumId, itemId, status: decision === "APPROVE" ? "APPROVED" : "REJECTED" } } });
      await tx.auditLog.create({ data: { userId: null, villageId, action: decision === "APPROVE" ? AuditAction.APPROVE : AuditAction.REJECT, resource: "GalleryItemSubmission", resourceId: submission.id, metadata: { actorRole: "SUPERADMIN", actorType: "SUPERADMIN_ENV", actionName: `GALLERY_SUBMISSION_${decision}D`, supportReason: support.value, businessReason: decision === "REJECT" ? businessReason : null, albumId: submission.albumId, itemId } } });
      await notifyVillageAdministrationOfSuperAdminIntervention(tx, { villageId, actionLabel: decision === "APPROVE" ? "อนุมัติรูปภาพที่ส่งเข้าร่วม" : "ปฏิเสธรูปภาพที่ส่งเข้าร่วม", supportReason: support.value, targetType: "GalleryItemSubmission", targetId: submission.id, targetName: submission.album.title, actionUrl: `/admin/gallery/submissions/${submission.id}`, metadata: { source: "GALLERY", submissionId: submission.id, albumId: submission.albumId, businessReason: decision === "REJECT" ? businessReason : null } });
    });
    refreshWorkspace(villageId, "gallery", submission.albumId); return { success: true, message: "บันทึกผลการพิจารณาแล้ว" };
  } catch (error) { return { success: false, error: error instanceof Error && error.message === "SUBMISSION_ALREADY_REVIEWED" ? "คำขอนี้ถูกดำเนินการแล้ว" : error instanceof Error ? error.message : "ไม่สามารถพิจารณาคำขอได้" }; }
}

async function transitionSuperAdminDownloadResultAction(villageId: string, downloadId: string, formData: FormData): Promise<Result> {
  try {
    await village(villageId); const supportReason = reason(formData.get("supportReason"));
    const stage = String(formData.get("stage") ?? "");
    const file = await prisma.downloadFile.findFirst({ where: { id: downloadId, villageId }, select: { id: true, title: true, stage: true } });
    if (!file) return { success: false, error: "ไม่พบเอกสารในหมู่บ้านนี้" };
    const valid = (stage === "PUBLISHED" && ["DRAFT", "ARCHIVED"].includes(file.stage)) || (stage === "ARCHIVED" && file.stage === "PUBLISHED") || (stage === "DRAFT" && file.stage === "ARCHIVED");
    if (!valid) return { success: false, error: "ไม่สามารถเปลี่ยนสถานะเอกสารนี้ได้" };
    await prisma.$transaction(async (tx) => {
      await tx.downloadFile.update({ where: { id: file.id }, data: { stage: stage as "DRAFT" | "PUBLISHED" | "ARCHIVED", ...(stage === "PUBLISHED" ? { publishedAt: new Date() } : {}) } });
      await tx.auditLog.create({ data: { userId: null, villageId, action: AuditAction.UPDATE, resource: "DownloadFile", resourceId: file.id, metadata: { actorRole: "SUPERADMIN", actorType: "SUPERADMIN_ENV", actionName: "DOWNLOAD_STAGE_CHANGED", supportReason, oldStage: file.stage, newStage: stage } } });
      await notifyVillageAdministrationOfSuperAdminIntervention(tx, { villageId, actionLabel: "เปลี่ยนสถานะเอกสารดาวน์โหลด", supportReason, targetType: "DownloadFile", targetId: file.id, targetName: file.title, actionUrl: "/admin/downloads", metadata: { fileId: file.id } });
    });
    if (stage === "PUBLISHED") await notifyResidents(villageId, "เอกสารดาวน์โหลด: เผยแพร่แล้ว", `เอกสาร ${file.title} พร้อมให้ดาวน์โหลดแล้ว`, { source: "DOWNLOAD", fileId: file.id, actionUrl: `/resident/downloads/${file.id}` });
    refreshWorkspace(villageId, "downloads", file.id); return { success: true, message: "เปลี่ยนสถานะเอกสารแล้ว" };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "ไม่สามารถเปลี่ยนสถานะเอกสารได้" }; }
}

async function reviewSuperAdminCalendarRequestResultAction(villageId: string, requestId: string, formData: FormData): Promise<Result> {
  try {
    await village(villageId); const supportReason = reason(formData.get("supportReason"));
    const decision = String(formData.get("decision") ?? "");
    const visibility = String(formData.get("visibility") ?? "RESIDENT");
    const businessReason = String(formData.get("businessReason") ?? "").trim();
    if (decision !== "APPROVE" && decision !== "REJECT") return { success: false, error: "คำสั่งพิจารณาไม่ถูกต้อง" };
    if (decision === "APPROVE" && visibility !== "PUBLIC" && visibility !== "RESIDENT") return { success: false, error: "การมองเห็นไม่ถูกต้อง" };
    if (decision === "REJECT" && (businessReason.length < 5 || businessReason.length > 500)) return { success: false, error: "กรุณาระบุเหตุผลปฏิเสธ 5–500 ตัวอักษร" };
    const request = await prisma.villageEventSubmission.findFirst({ where: { id: requestId, villageId, status: "PENDING" } });
    if (!request) return { success: false, error: "ไม่พบคำขอในหมู่บ้านนี้ หรือคำขอถูกดำเนินการแล้ว" };
    const approved = decision === "APPROVE";
    await prisma.$transaction(async (tx) => {
      let eventId = request.eventId ?? "";
      if (approved) {
        const isPublic = visibility === "PUBLIC";
        if (request.type === "CREATE") {
          const event = await tx.villageEvent.create({ data: { villageId, createdById: null, title: request.title, description: request.description, location: request.location, startsAt: request.startsAt, endsAt: request.endsAt, isPublic }, select: { id: true } });
          eventId = event.id;
        } else {
          const event = request.eventId ? await tx.villageEvent.findFirst({ where: { id: request.eventId, villageId }, select: { id: true } }) : null;
          if (!event) throw new Error("ไม่พบกิจกรรมเป้าหมายในหมู่บ้านนี้");
          eventId = event.id;
          if (request.type === "DELETE") await tx.villageEvent.delete({ where: { id: event.id } });
          if (request.type === "EDIT") await tx.villageEvent.update({ where: { id: event.id }, data: { title: request.title, description: request.description, location: request.location, startsAt: request.startsAt, endsAt: request.endsAt, isPublic } });
        }
      }
      await tx.villageEventSubmission.update({ where: { id: request.id }, data: { status: approved ? "APPROVED" : "REJECTED", reviewedBy: null, reviewedAt: new Date(), reviewNote: approved ? null : businessReason, ...(approved ? { eventId } : {}) } });
      await tx.notification.create({ data: { userId: request.requesterId, villageId, type: NotificationType.SYSTEM, title: approved ? "คำขอกิจกรรมได้รับการอนุมัติ" : "คำขอกิจกรรมไม่ได้รับการอนุมัติ", body: approved ? `“${request.title}” ถูกดำเนินการแล้ว` : `เหตุผล: ${businessReason}`, metadata: { source: "CALENDAR", requestId: request.id, eventId: eventId || null, status: approved ? "APPROVED" : "REJECTED", actionUrl: eventId ? `/resident/calendar/${eventId}` : "/resident/calendar/requests" } } });
      await tx.auditLog.create({ data: { userId: null, villageId, action: approved ? AuditAction.APPROVE : AuditAction.REJECT, resource: "VillageEventSubmission", resourceId: request.id, metadata: { actorRole: "SUPERADMIN", actorType: "SUPERADMIN_ENV", actionName: `CALENDAR_REQUEST_${approved ? "APPROVED" : "REJECTED"}`, supportReason, businessReason: approved ? null : businessReason, requesterId: request.requesterId, eventId, finalVisibility: approved ? visibility : null } } });
      await notifyVillageAdministrationOfSuperAdminIntervention(tx, { villageId, actionLabel: approved ? "อนุมัติคำขอกิจกรรม" : "ปฏิเสธคำขอกิจกรรม", supportReason, targetType: "VillageEventSubmission", targetId: request.id, targetName: request.title, actionUrl: eventId ? `/admin/calendar/${eventId}` : "/admin/calendar/requests", metadata: { requestId: request.id, eventId: eventId || null } });
    });
    refreshWorkspace(villageId, "calendar"); return { success: true, message: "บันทึกผลการพิจารณาแล้ว" };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "ไม่สามารถพิจารณาคำขอได้" }; }
}

async function updateSuperAdminIssueResultAction(villageId: string, issueId: string, formData: FormData): Promise<Result> {
  try {
    await village(villageId);
    const supportReason = reason(formData.get("supportReason"));
    const nextStatus = String(formData.get("status") ?? "") as IssueUserStatus;
    const note = String(formData.get("note") ?? "").trim();
    if (!Object.hasOwn(ISSUE_USER_STATUS_TO_STAGE, nextStatus)) return { success: false, error: "สถานะไม่ถูกต้อง" };
    const issue = await prisma.issue.findFirst({ where: { id: issueId, villageId } });
    if (!issue) return { success: false, error: "ไม่พบปัญหาในหมู่บ้านนี้" };
    const current = getIssueUserStatus(issue.stage);
    if (!ISSUE_ALLOWED_TRANSITIONS[current].includes(nextStatus)) return { success: false, error: "ไม่สามารถเปลี่ยนสถานะตามลำดับงานนี้ได้" };
    const stage = ISSUE_USER_STATUS_TO_STAGE[nextStatus] as IssueStage;
    await prisma.$transaction(async (tx) => {
      await tx.issue.update({ where: { id: issue.id }, data: { stage, ...(nextStatus === "RESOLVED" ? { resolvedAt: new Date() } : {}) } });
      await tx.issueTimeline.create({ data: { issueId: issue.id, actorId: null, action: "อัปเดตสถานะ", description: note || null, metadata: { eventType: "STATUS_CHANGE", fromStatus: current, toStatus: nextStatus, supportReason } } });
      await tx.auditLog.create({ data: { userId: null, villageId, action: AuditAction.UPDATE, resource: "Issue", resourceId: issue.id, metadata: { actorRole: "SUPERADMIN", actorType: "SUPERADMIN_ENV", actionName: "ISSUE_STATUS_CHANGED", supportReason, domainNote: note || null, oldStatus: current, newStatus: nextStatus } } });
      await notifyVillageAdministrationOfSuperAdminIntervention(tx, { villageId, actionLabel: "อัปเดตสถานะคำร้อง", supportReason, targetType: "Issue", targetId: issue.id, targetName: issue.title, actionUrl: `/admin/issues/${issue.id}`, metadata: { issueId: issue.id } });
      await tx.notification.create({ data: { villageId, userId: issue.reporterId, type: NotificationType.ISSUE_UPDATE, title: "สถานะคำร้องถูกอัปเดต", body: `${issue.title} · ${ISSUE_STATUS_META[nextStatus].label}`, metadata: { source: "ISSUE", issueId: issue.id, stage: nextStatus, note: note || undefined } } });
    });
    refresh(villageId, "issues", issue.id);
    return { success: true, message: "อัปเดตสถานะปัญหาแล้ว" };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "ไม่สามารถอัปเดตปัญหาได้" }; }
}

async function addSuperAdminIssueMessageResultAction(villageId: string, issueId: string, formData: FormData): Promise<Result> {
  try {
    await village(villageId);
    const supportReason = reason(formData.get("supportReason"));
    const content = String(formData.get("content") ?? "").trim();
    const isInternal = formData.get("isInternal") === "true";
    if (content.length < 2) return { success: false, error: "กรุณาระบุข้อความอย่างน้อย 2 ตัวอักษร" };
    const issue = await prisma.issue.findFirst({ where: { id: issueId, villageId } });
    if (!issue) return { success: false, error: "ไม่พบปัญหาในหมู่บ้านนี้" };
    await prisma.$transaction(async (tx) => {
      await tx.issueMessage.create({ data: { issueId: issue.id, senderId: SUPERADMIN_ISSUE_MESSAGE_SENDER_ID, content, isInternal } });
      if (!isInternal) await tx.issueTimeline.create({ data: { issueId: issue.id, actorId: SUPERADMIN_ISSUE_MESSAGE_SENDER_ID, action: "แสดงความคิดเห็น", description: content, metadata: { eventType: "COMMENT", actorRole: "SUPERADMIN", actorType: "SUPERADMIN_ENV", supportReason } } });
      await tx.auditLog.create({ data: { userId: null, villageId, action: AuditAction.UPDATE, resource: "Issue", resourceId: issue.id, metadata: { actorRole: "SUPERADMIN", actorType: "SUPERADMIN_ENV", actionName: "ISSUE_MESSAGE_ADDED", supportReason, isInternal } } });
      await notifyVillageAdministrationOfSuperAdminIntervention(tx, { villageId, actionLabel: "เพิ่มข้อความในคำร้อง", supportReason, targetType: "Issue", targetId: issue.id, targetName: issue.title, actionUrl: `/admin/issues/${issue.id}`, metadata: { issueId: issue.id } });
      if (!isInternal) await tx.notification.create({ data: { villageId, userId: issue.reporterId, type: NotificationType.ISSUE_UPDATE, title: "มีข้อความใหม่ในคำร้อง", body: content, metadata: { source: "ISSUE", issueId: issue.id } } });
    });
    refresh(villageId, "issues", issue.id);
    return { success: true, message: "เพิ่มข้อความแล้ว" };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "ไม่สามารถเพิ่มข้อความได้" }; }
}

async function deleteSuperAdminIssueResultAction(villageId: string, issueId: string, formData: FormData): Promise<Result> {
  try {
    // This verifies both the Super Admin session and the route village before using either submitted value.
    await village(villageId);

    let businessReason: string;
    try {
      businessReason = requireActionReason("issue.cancel", formData.get("businessReason"));
    } catch (error) {
      if (error instanceof ActionReasonError) return { success: false, error: "เหตุผลที่ลบคำร้องต้องมี 5–500 ตัวอักษร" };
      throw error;
    }
    if (businessReason.length > 500) return { success: false, error: "เหตุผลที่ลบคำร้องต้องมี 5–500 ตัวอักษร" };
    const supportReason = reason(formData.get("supportReason"));

    // Scope the lookup to the route village so a forged Issue id cannot cross village boundaries.
    const issue = await prisma.issue.findFirst({ where: { id: issueId, villageId } });
    if (!issue) return { success: false, error: "ไม่พบคำร้องในหมู่บ้านนี้" };

    await prisma.$transaction(async (tx) => {
      // Keep the established Admin deletion semantics: notify, audit, remove restrictive SavedItems, then delete.
      await tx.notification.create({
        data: {
          villageId,
          userId: issue.reporterId,
          type: NotificationType.ISSUE_UPDATE,
          title: "คำร้องของคุณถูกลบโดยผู้ดูแลหมู่บ้าน",
          body: `เหตุผล: ${businessReason}`,
          metadata: notificationMetadata("ISSUE", { action: "ISSUE_DELETED", issueTitle: issue.title, deletionReason: businessReason }),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: null,
          villageId,
          action: AuditAction.DELETE,
          resource: "Issue",
          resourceId: issue.id,
          metadata: {
            actorRole: "SUPERADMIN",
            actorType: "SUPERADMIN_ENV",
            policyAction: "issue.cancel",
            actionName: "ISSUE_DELETED_BY_SUPERADMIN",
            issueTitle: issue.title,
            reporterId: issue.reporterId,
            businessReason,
            supportReason,
            issueStage: issue.stage,
            issueCategory: issue.category,
          },
        },
      });
      await notifyVillageAdministrationOfSuperAdminIntervention(tx, {
        villageId,
        actionLabel: "ลบคำร้องปัญหา",
        supportReason,
        targetType: "Issue",
        targetId: issue.id,
        targetName: issue.title,
        actionUrl: "/admin/issues",
        metadata: { issueId: issue.id, businessReason },
      });
      await tx.savedItem.deleteMany({ where: { issueId: issue.id } });
      await tx.issue.delete({ where: { id: issue.id } });
    });

    refresh(villageId, "issues", issue.id);
    revalidatePath("/admin/issues");
    revalidatePath(`/admin/issues/${issue.id}`);
    revalidatePath("/admin/notifications");
    revalidatePath("/resident/saved");
    return { success: true, message: "ลบคำร้องเรียบร้อยแล้ว" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "ไม่สามารถลบคำร้องได้" };
  }
}

async function proposeSuperAdminAppointmentTimeResultAction(villageId: string, appointmentId: string, formData: FormData): Promise<Result> {
  try {
    await village(villageId);
    const supportReason = reason(formData.get("supportReason"));
    const dateText = String(formData.get("date") ?? ""); const startTime = String(formData.get("startTime") ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) return { success: false, error: "วันหรือเวลาไม่ถูกต้อง" };
    const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, villageId } });
    if (!appointment || appointment.stage !== "PENDING_APPROVAL") return { success: false, error: "นัดหมายนี้เสนอวันเวลาไม่ได้" };
    const firstTimeline = await prisma.appointmentTimeline.findFirst({ where: { appointmentId: appointment.id }, orderBy: { createdAt: "asc" }, select: { metadata: true } });
    const creationMetadata = firstTimeline?.metadata;
    if (creationMetadata && typeof creationMetadata === "object" && !Array.isArray(creationMetadata) && creationMetadata.adminCreated === true) return { success: false, error: "นัดหมายที่ผู้ดูแลสร้างไม่สามารถเสนอวันเวลาในสถานะนี้ได้" };
    const hour = Number(startTime.slice(0, 2)); const endTime = `${String(hour + 1).padStart(2, "0")}:00`;
    if (hour >= 23) return { success: false, error: "เวลาเริ่มต้นต้องไม่เกิน 22:59 น." };
    const date = new Date(`${dateText}T00:00:00.000Z`);
    await prisma.$transaction(async (tx) => {
      const slot = await tx.appointmentSlot.create({ data: { villageId, date, startTime, endTime, maxCapacity: 1, note: `เวลาเสนอสำหรับนัด ${appointment.id}` } });
      await tx.appointment.update({ where: { id: appointment.id }, data: { slotId: slot.id, scheduledAt: date, stage: "TIME_SUGGESTED", reviewedAt: new Date() } });
      await tx.appointmentTimeline.create({ data: { appointmentId: appointment.id, actorId: null, action: "TIME_SUGGESTED", description: "ผู้ดูแลระบบเสนอวันเวลาให้ลูกบ้านยืนยัน", metadata: { slotDate: date, slotTime: startTime, actorRole: "SUPERADMIN", actorType: "SUPERADMIN_ENV", supportReason } } });
      await tx.auditLog.create({ data: { userId: null, villageId, action: AuditAction.UPDATE, resource: "Appointment", resourceId: appointment.id, metadata: { actorRole: "SUPERADMIN", actorType: "SUPERADMIN_ENV", actionName: "APPOINTMENT_TIME_SUGGESTED", supportReason, date: dateText, startTime } } });
      await notifyVillageAdministrationOfSuperAdminIntervention(tx, { villageId, actionLabel: "เสนอเวลานัดหมาย", supportReason, targetType: "Appointment", targetId: appointment.id, targetName: appointment.title, actionUrl: `/admin/appointments/${appointment.id}`, metadata: { appointmentId: appointment.id } });
      await tx.notification.create({ data: { villageId, userId: appointment.userId, type: NotificationType.APPOINTMENT_UPDATE, title: "มีการเสนอเวลานัดหมาย", body: `นัดหมาย “${appointment.title}” มีวันเวลาใหม่ให้ยืนยัน`, metadata: { appointmentId: appointment.id } } });
    });
    refresh(villageId, "appointments", appointment.id);
    return { success: true, message: "เสนอวันเวลาแล้ว" };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "ไม่สามารถเสนอวันเวลาได้" }; }
}

async function changeSuperAdminAppointmentStageResultAction(villageId: string, appointmentId: string, formData: FormData): Promise<Result> {
  try {
    await village(villageId);
    const supportReason = reason(formData.get("supportReason"));
    const action = String(formData.get("action") ?? "");
    const businessReason = String(formData.get("businessReason") ?? "").trim();
    const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, villageId } });
    if (!appointment) return { success: false, error: "ไม่พบนัดหมายในหมู่บ้านนี้" };
    const next = action === "REJECT" ? "REJECTED" : action === "CANCEL" ? "CANCELLED" : null;
    const validStage = action === "REJECT"
      ? appointment.stage === "PENDING_APPROVAL"
      : action === "CANCEL" && ["TIME_SUGGESTED", "APPROVED"].includes(appointment.stage);
    if (!next || !validStage) return { success: false, error: "ไม่สามารถดำเนินการกับนัดหมายในสถานะนี้ได้" };
    if (action === "REJECT") {
      const firstTimeline = await prisma.appointmentTimeline.findFirst({ where: { appointmentId: appointment.id }, orderBy: { createdAt: "asc" }, select: { metadata: true } });
      const creationMetadata = firstTimeline?.metadata;
      if (creationMetadata && typeof creationMetadata === "object" && !Array.isArray(creationMetadata) && creationMetadata.adminCreated === true) return { success: false, error: "ปฏิเสธได้เฉพาะคำขอนัดหมายของลูกบ้าน" };
    }
    if (businessReason.length < 5 || businessReason.length > 500) return { success: false, error: "กรุณาระบุเหตุผล 5–500 ตัวอักษร" };
    await prisma.$transaction(async (tx) => {
      await tx.appointment.update({ where: { id: appointment.id }, data: { stage: next, reviewedAt: new Date(), reviewNote: businessReason } });
      await tx.appointmentTimeline.create({ data: { appointmentId: appointment.id, actorId: null, action: next, description: `${next === "REJECTED" ? "ปฏิเสธ" : "ยกเลิก"}นัดหมาย | เหตุผล: ${businessReason}`, metadata: { reason: businessReason, actorRole: "SUPERADMIN", actorType: "SUPERADMIN_ENV", supportReason } } });
      await tx.auditLog.create({ data: { userId: null, villageId, action: next === "REJECTED" ? AuditAction.REJECT : AuditAction.UPDATE, resource: "Appointment", resourceId: appointment.id, metadata: { actorRole: "SUPERADMIN", actorType: "SUPERADMIN_ENV", actionName: `APPOINTMENT_${next}`, supportReason, businessReason, affectedUserId: appointment.userId, oldStage: appointment.stage, newStage: next } } });
      await notifyVillageAdministrationOfSuperAdminIntervention(tx, { villageId, actionLabel: next === "REJECTED" ? "ปฏิเสธนัดหมาย" : "ยกเลิกนัดหมาย", supportReason, targetType: "Appointment", targetId: appointment.id, targetName: appointment.title, actionUrl: `/admin/appointments/${appointment.id}`, metadata: { appointmentId: appointment.id } });
      await tx.notification.create({ data: { villageId, userId: appointment.userId, type: NotificationType.APPOINTMENT_UPDATE, title: next === "REJECTED" ? "นัดหมายไม่ได้รับการยืนยัน" : "นัดหมายถูกยกเลิก", body: `นัดหมาย “${appointment.title}” ${next === "REJECTED" ? "ไม่ได้รับการยืนยัน" : "ถูกยกเลิก"} เหตุผล: ${businessReason}`, metadata: { appointmentId: appointment.id } } });
    });
    refresh(villageId, "appointments", appointment.id);
    return { success: true, message: action === "REJECT" ? "ปฏิเสธนัดหมายแล้ว" : "ยกเลิกนัดหมายแล้ว" };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "ไม่สามารถดำเนินการกับนัดหมายได้" }; }
}

export async function saveSuperAdminGalleryAlbumAction(villageId: string, formData: FormData): Promise<Result> {
  return saveSuperAdminGalleryAlbumResultAction(villageId, formData);
}

export async function deleteSuperAdminGalleryAlbumAction(villageId: string, albumId: string, formData: FormData): Promise<Result> {
  return deleteSuperAdminGalleryAlbumResultAction(villageId, albumId, formData);
}

export async function reviewSuperAdminGallerySubmissionAction(villageId: string, submissionId: string, formData: FormData): Promise<Result> {
  return reviewSuperAdminGallerySubmissionResultAction(villageId, submissionId, formData);
}

export async function transitionSuperAdminDownloadAction(villageId: string, downloadId: string, formData: FormData): Promise<void> {
  await transitionSuperAdminDownloadResultAction(villageId, downloadId, formData);
}

export async function reviewSuperAdminCalendarRequestAction(villageId: string, requestId: string, formData: FormData): Promise<Result> {
  return reviewSuperAdminCalendarRequestResultAction(villageId, requestId, formData);
}

export async function updateSuperAdminIssueAction(villageId: string, issueId: string, formData: FormData): Promise<Result> {
  return updateSuperAdminIssueResultAction(villageId, issueId, formData);
}

export async function addSuperAdminIssueMessageAction(villageId: string, issueId: string, formData: FormData): Promise<Result> {
  return addSuperAdminIssueMessageResultAction(villageId, issueId, formData);
}

export async function deleteSuperAdminIssueAction(villageId: string, issueId: string, formData: FormData): Promise<Result> {
  return deleteSuperAdminIssueResultAction(villageId, issueId, formData);
}

export async function proposeSuperAdminAppointmentTimeAction(villageId: string, appointmentId: string, formData: FormData): Promise<Result> {
  return proposeSuperAdminAppointmentTimeResultAction(villageId, appointmentId, formData);
}

export async function changeSuperAdminAppointmentStageAction(villageId: string, appointmentId: string, formData: FormData): Promise<Result> {
  return changeSuperAdminAppointmentStageResultAction(villageId, appointmentId, formData);
}
