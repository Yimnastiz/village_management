"use server";

import { DownloadStage, NewsVisibility, NotificationType, Prisma, VillageMembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { MAX_DOWNLOAD_TOTAL_BYTES } from "@/lib/download-upload";
import { deleteDownloadUploads, verifyDownloadUploadToken } from "@/lib/download-upload.server";
import { prisma } from "@/lib/prisma";
import { getAdminMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { downloadFormSchema } from "@/lib/downloads/schema";
import type { DownloadActionResult, DownloadFormInput } from "@/lib/downloads/types";

const RESIDENT_MEMBERSHIP_ROLES: VillageMembershipRole[] = [VillageMembershipRole.RESIDENT];

async function requireAdminVillage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { ok: false as const, error: "กรุณาเข้าสู่ระบบ", session: null, villageId: "" };
  const membership = getAdminMembership(session);
  if (!membership) return { ok: false as const, error: "ไม่พบสิทธิ์ผู้ดูแลหมู่บ้าน", session: null, villageId: "" };
  return { ok: true as const, error: null, session, villageId: membership.villageId };
}

function invalid(error: string, fieldErrors?: Record<string, string>): DownloadActionResult {
  return { success: false, error, ...(fieldErrors ? { fieldErrors } : {}) };
}

function normalizeInput(data: DownloadFormInput) {
  const parsed = downloadFormSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(Object.entries(parsed.error.flatten().fieldErrors).flatMap(([key, values]) => values?.[0] ? [[key, values[0]]] : []));
    return { ok: false as const, result: invalid(Object.values(fieldErrors)[0] ?? "ข้อมูลไม่ถูกต้อง", fieldErrors) };
  }
  if (parsed.data.category === "OTHER" && !parsed.data.categoryLabel) return { ok: false as const, result: invalid("กรุณาระบุหมวดหมู่", { categoryLabel: "กรุณาระบุหมวดหมู่" }) };
  if (parsed.data.category !== "OTHER" && parsed.data.categoryLabel) return { ok: false as const, result: invalid("หมวดหมู่ไม่ถูกต้อง", { category: "หมวดหมู่ไม่ถูกต้อง" }) };
  if (parsed.data.attachments.reduce((total, item) => total + (item.fileSize ?? 0), 0) > MAX_DOWNLOAD_TOTAL_BYTES) return { ok: false as const, result: invalid("ขนาดไฟล์รวมต้องไม่เกิน 100 MB", { attachments: "ขนาดไฟล์รวมต้องไม่เกิน 100 MB" }) };
  return { ok: true as const, value: parsed.data };
}

async function getResidentRecipientIds(villageId: string) {
  const residents = await prisma.villageMembership.findMany({ where: { villageId, status: "ACTIVE", role: { in: RESIDENT_MEMBERSHIP_ROLES } }, select: { userId: true }, distinct: ["userId"] });
  return residents.map((item) => item.userId);
}

async function notifyResidents(villageId: string, title: string, body: string, metadata?: Prisma.InputJsonObject) {
  const recipientIds = await getResidentRecipientIds(villageId);
  if (!recipientIds.length) return;
  await prisma.notification.createMany({ data: recipientIds.map((userId) => ({ userId, villageId, type: NotificationType.SYSTEM, title, body, ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}) })) });
}

function revalidateDownloadViews(fileId?: string) {
  revalidatePath("/resident/downloads");
  revalidatePath("/resident/saved");
  revalidatePath("/admin/downloads");
  revalidatePath("/resident/notifications");
  revalidatePath("/admin/notifications");
  if (fileId) {
    revalidatePath(`/resident/downloads/${fileId}`);
    revalidatePath(`/admin/downloads/${fileId}`);
    revalidatePath(`/admin/downloads/${fileId}/edit`);
  }
}

async function resolveAttachments(input: DownloadFormInput["attachments"], existing: Array<{ id: string; fileName: string; fileKey: string | null; fileUrl: string; fileSize: number; mimeType: string | null }>, villageId: string, userId: string) {
  const existingById = new Map(existing.map((item) => [item.id, item]));
  const usedExistingIds = new Set<string>();
  const resolved: Array<{ id?: string; fileName: string; fileKey: string | null; fileUrl: string; fileSize: number; mimeType: string | null }> = [];
  for (const item of input) {
    if (item.id) {
      const persisted = existingById.get(item.id);
      if (!persisted || usedExistingIds.has(item.id)) return { ok: false as const, result: invalid("ข้อมูลไฟล์แนบไม่ถูกต้อง", { attachments: "ข้อมูลไฟล์แนบไม่ถูกต้อง" }) };
      usedExistingIds.add(item.id);
      resolved.push(persisted);
      continue;
    }
    if (!item.fileName || !item.fileKey || !item.fileUrl || !item.fileSize || !item.mimeType || !verifyDownloadUploadToken(item.uploadToken, item.fileKey, villageId, userId)) return { ok: false as const, result: invalid("ข้อมูลไฟล์ที่อัปโหลดไม่ถูกต้อง กรุณาอัปโหลดใหม่", { attachments: "ข้อมูลไฟล์ที่อัปโหลดไม่ถูกต้อง กรุณาอัปโหลดใหม่" }) };
    resolved.push({ fileName: item.fileName, fileKey: item.fileKey, fileUrl: item.fileUrl, fileSize: item.fileSize, mimeType: item.mimeType });
  }
  return { ok: true as const, value: resolved, removedKeys: existing.filter((item) => !usedExistingIds.has(item.id)).map((item) => item.fileKey).filter((value): value is string => Boolean(value)) };
}

export async function createDownloadAction(data: DownloadFormInput, stage: "DRAFT" | "PUBLISHED"): Promise<DownloadActionResult> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return invalid(ctx.error);
  const normalized = normalizeInput(data);
  if (!normalized.ok) return normalized.result;
  const attachments = await resolveAttachments(normalized.value.attachments, [], ctx.villageId, ctx.session.id);
  if (!attachments.ok) return attachments.result;
  const primary = attachments.value[0];
  const created = await prisma.downloadFile.create({
    data: {
      villageId: ctx.villageId, title: normalized.value.title, description: normalized.value.description || null,
      category: normalized.value.category, categoryLabel: normalized.value.category === "OTHER" ? normalized.value.categoryLabel : null,
      visibility: normalized.value.visibility as NewsVisibility, stage, publishedAt: stage === "PUBLISHED" ? new Date() : null,
      fileKey: primary.fileKey, fileUrl: primary.fileUrl, fileSize: primary.fileSize, mimeType: primary.mimeType,
      attachments: { create: attachments.value.map((attachment, sortOrder) => ({ ...attachment, sortOrder })) },
    }, select: { id: true },
  });
  if (stage === "PUBLISHED") await notifyResidents(ctx.villageId, "เอกสารดาวน์โหลด: มีเอกสารใหม่", `เอกสาร ${normalized.value.title} พร้อมให้ดาวน์โหลดแล้ว`, { fileId: created.id, actionUrl: `/resident/downloads/${created.id}` });
  revalidateDownloadViews(created.id);
  return { success: true, id: created.id };
}

export async function updateDownloadAction(fileId: string, data: DownloadFormInput): Promise<DownloadActionResult> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return invalid(ctx.error);
  const normalized = normalizeInput(data);
  if (!normalized.ok) return normalized.result;
  const existing = await prisma.downloadFile.findFirst({ where: { id: fileId, villageId: ctx.villageId }, include: { attachments: { orderBy: { sortOrder: "asc" } } } });
  if (!existing) return invalid("ไม่พบเอกสารนี้หรือไม่มีสิทธิ์แก้ไข");
  const attachments = await resolveAttachments(normalized.value.attachments, existing.attachments, ctx.villageId, ctx.session.id);
  if (!attachments.ok) return attachments.result;
  const primary = attachments.value[0];
  const existingIds = new Set(existing.attachments.map((item) => item.id));
  await prisma.$transaction(async (tx) => {
    await tx.downloadFile.update({ where: { id: fileId }, data: {
      title: normalized.value.title, description: normalized.value.description || null, category: normalized.value.category,
      categoryLabel: normalized.value.category === "OTHER" ? normalized.value.categoryLabel : null, visibility: normalized.value.visibility as NewsVisibility,
      fileKey: primary.fileKey, fileUrl: primary.fileUrl, fileSize: primary.fileSize, mimeType: primary.mimeType,
    } });
    const retainedIds = attachments.value.flatMap((item) => item.id ? [item.id] : []);
    await tx.downloadAttachment.deleteMany({ where: { downloadId: fileId, id: { notIn: retainedIds } } });
    for (const [sortOrder, attachment] of attachments.value.entries()) {
      if (attachment.id && existingIds.has(attachment.id)) await tx.downloadAttachment.update({ where: { id: attachment.id }, data: { sortOrder } });
      else await tx.downloadAttachment.create({ data: { downloadId: fileId, fileName: attachment.fileName, fileKey: attachment.fileKey, fileUrl: attachment.fileUrl, fileSize: attachment.fileSize, mimeType: attachment.mimeType, sortOrder } });
    }
  });
  if (existing.stage === "PUBLISHED" && (attachments.value.length !== existing.attachments.length || attachments.removedKeys.length > 0 || attachments.value.some((item) => !item.id))) await notifyResidents(ctx.villageId, "เอกสารดาวน์โหลด: อัปเดตไฟล์แนบ", `เอกสาร ${normalized.value.title} มีการอัปเดตไฟล์แนบ`, { fileId, actionUrl: `/resident/downloads/${fileId}` });
  void deleteDownloadUploads(attachments.removedKeys);
  revalidateDownloadViews(fileId);
  return { success: true };
}

export async function publishDownloadAction(fileId: string): Promise<DownloadActionResult> {
  return transitionDownload(fileId, "PUBLISHED", ["DRAFT", "ARCHIVED"]);
}

export async function archiveDownloadAction(fileId: string): Promise<DownloadActionResult> {
  return transitionDownload(fileId, "ARCHIVED", ["PUBLISHED"]);
}

export async function restoreDownloadAction(fileId: string): Promise<DownloadActionResult> {
  return transitionDownload(fileId, "DRAFT", ["ARCHIVED"]);
}

async function transitionDownload(fileId: string, nextStage: DownloadStage, allowedCurrent: DownloadStage[]): Promise<DownloadActionResult> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return invalid(ctx.error);
  const existing = await prisma.downloadFile.findFirst({ where: { id: fileId, villageId: ctx.villageId }, select: { id: true, title: true, stage: true } });
  if (!existing) return invalid("ไม่พบเอกสารนี้หรือไม่มีสิทธิ์ดำเนินการ");
  if (!allowedCurrent.includes(existing.stage)) return invalid("ไม่สามารถเปลี่ยนสถานะเอกสารจากสถานะปัจจุบันได้");
  await prisma.downloadFile.update({ where: { id: fileId }, data: { stage: nextStage, ...(nextStage === "PUBLISHED" ? { publishedAt: new Date() } : {}) } });
  if (nextStage === "PUBLISHED") await notifyResidents(ctx.villageId, existing.stage === "ARCHIVED" ? "เอกสารดาวน์โหลด: เผยแพร่อีกครั้ง" : "เอกสารดาวน์โหลด: เผยแพร่แล้ว", `เอกสาร ${existing.title} พร้อมให้ดาวน์โหลดแล้ว`, { fileId, actionUrl: `/resident/downloads/${fileId}` });
  revalidateDownloadViews(fileId);
  return { success: true };
}

export async function deleteDownloadAction(fileId: string): Promise<DownloadActionResult> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return invalid(ctx.error);
  const existing = await prisma.downloadFile.findFirst({ where: { id: fileId, villageId: ctx.villageId }, include: { attachments: { select: { fileKey: true } } } });
  if (!existing) return invalid("ไม่พบเอกสารนี้หรือไม่มีสิทธิ์ลบ");
  await prisma.$transaction(async (tx) => {
    await tx.savedItem.deleteMany({ where: { downloadId: fileId } });
    await tx.downloadFile.delete({ where: { id: fileId } });
  });
  void deleteDownloadUploads(existing.attachments.map((item) => item.fileKey).filter((value): value is string => Boolean(value)));
  revalidateDownloadViews(fileId);
  return { success: true };
}
