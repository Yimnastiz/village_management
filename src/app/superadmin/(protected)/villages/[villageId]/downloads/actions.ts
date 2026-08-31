"use server";

import { AuditAction, DownloadStage, NewsVisibility, NotificationType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { deleteDownloadUploads, verifyDownloadUploadToken } from "@/lib/download-upload.server";
import { MAX_DOWNLOAD_TOTAL_BYTES } from "@/lib/download-upload";
import { downloadFormSchema } from "@/lib/downloads/schema";
import type { DownloadActionResult, DownloadFormInput } from "@/lib/downloads/types";
import { prisma } from "@/lib/prisma";
import { notifyVillageAdministrationOfSuperAdminIntervention } from "@/lib/superadmin-village-intervention";
import { requireSuperAdminVillageContext, requireSupportReason } from "@/features/village-public-content/server/context";
import { notificationMetadata } from "@/lib/notification-copy";
import { SUPERADMIN_ISSUE_MESSAGE_SENDER_ID } from "@/lib/superadmin-auth";

function invalid(error: string, fieldErrors?: Record<string, string>): DownloadActionResult { return { success: false, error, ...(fieldErrors ? { fieldErrors } : {}) }; }

function normalize(data: DownloadFormInput) {
  const parsed = downloadFormSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(Object.entries(parsed.error.flatten().fieldErrors).flatMap(([key, values]) => values?.[0] ? [[key, values[0]]] : []));
    return { ok: false as const, result: invalid(Object.values(fieldErrors)[0] ?? "ข้อมูลเอกสารไม่ถูกต้อง", fieldErrors) };
  }
  if (parsed.data.category === "OTHER" && !parsed.data.categoryLabel) return { ok: false as const, result: invalid("กรุณาระบุหมวดหมู่", { categoryLabel: "กรุณาระบุหมวดหมู่" }) };
  if (parsed.data.category !== "OTHER" && parsed.data.categoryLabel) return { ok: false as const, result: invalid("หมวดหมู่ไม่ถูกต้อง", { category: "หมวดหมู่ไม่ถูกต้อง" }) };
  if (parsed.data.attachments.reduce((sum, item) => sum + (item.fileSize ?? 0), 0) > MAX_DOWNLOAD_TOTAL_BYTES) return { ok: false as const, result: invalid("ขนาดไฟล์รวมต้องไม่เกิน 100 MB", { attachments: "ขนาดไฟล์รวมต้องไม่เกิน 100 MB" }) };
  return { ok: true as const, value: parsed.data };
}

async function resolveAttachments(input: DownloadFormInput["attachments"], existing: Array<{ id: string; fileName: string; fileKey: string | null; fileUrl: string; fileSize: number; mimeType: string | null }>, villageId: string) {
  const byId = new Map(existing.map((item) => [item.id, item]));
  const used = new Set<string>();
  const resolved: Array<{ id?: string; fileName: string; fileKey: string | null; fileUrl: string; fileSize: number; mimeType: string | null }> = [];
  for (const item of input) {
    if (item.id) {
      const old = byId.get(item.id);
      if (!old || used.has(item.id)) return { ok: false as const, result: invalid("ไฟล์แนบไม่ถูกต้อง", { attachments: "ไฟล์แนบไม่ถูกต้อง" }) };
      used.add(item.id); resolved.push(old); continue;
    }
    if (!item.fileName || !item.fileKey || !item.fileUrl || !item.fileSize || !item.mimeType || !verifyDownloadUploadToken(item.uploadToken, item.fileKey, villageId, SUPERADMIN_ISSUE_MESSAGE_SENDER_ID)) return { ok: false as const, result: invalid("ข้อมูลไฟล์อัปโหลดไม่ถูกต้อง กรุณาอัปโหลดใหม่", { attachments: "ข้อมูลไฟล์อัปโหลดไม่ถูกต้อง กรุณาอัปโหลดใหม่" }) };
    resolved.push({ fileName: item.fileName, fileKey: item.fileKey, fileUrl: item.fileUrl, fileSize: item.fileSize, mimeType: item.mimeType });
  }
  return { ok: true as const, value: resolved, removedKeys: existing.filter((item) => !used.has(item.id)).map((item) => item.fileKey).filter((value): value is string => Boolean(value)) };
}

function refresh(villageId: string, id?: string) {
  revalidatePath(`/superadmin/villages/${villageId}/downloads`); revalidatePath(`/superadmin/villages/${villageId}/audit`); revalidatePath("/resident/downloads"); revalidatePath("/resident/notifications");
  if (id) { revalidatePath(`/superadmin/villages/${villageId}/downloads/${id}`); revalidatePath(`/superadmin/villages/${villageId}/downloads/${id}/edit`); revalidatePath(`/resident/downloads/${id}`); }
}

async function notifyResidents(villageId: string, title: string, body: string, fileId: string) {
  const residents = await prisma.villageMembership.findMany({ where: { villageId, status: "ACTIVE", role: "RESIDENT" }, select: { userId: true }, distinct: ["userId"] });
  if (residents.length) await prisma.notification.createMany({ data: residents.map(({ userId }) => ({ userId, villageId, type: NotificationType.SYSTEM, title, body, metadata: notificationMetadata("DOWNLOAD", { fileId, actionUrl: `/resident/downloads/${fileId}` }) })) });
}

export async function superAdminCreateDownloadAction(villageId: string, data: DownloadFormInput, stage: "DRAFT" | "PUBLISHED", reasonInput: string): Promise<DownloadActionResult> {
  try {
    const context = await requireSuperAdminVillageContext(villageId); const reason = requireSupportReason(reasonInput); const normalized = normalize(data); if (!normalized.ok) return normalized.result;
    const attachments = await resolveAttachments(normalized.value.attachments, [], context.villageId); if (!attachments.ok) return attachments.result;
    const primary = attachments.value[0];
    const created = await prisma.$transaction(async (tx) => {
      const file = await tx.downloadFile.create({ data: { villageId: context.villageId, title: normalized.value.title, description: normalized.value.description || null, category: normalized.value.category, categoryLabel: normalized.value.category === "OTHER" ? normalized.value.categoryLabel : null, visibility: normalized.value.visibility as NewsVisibility, stage, publishedAt: stage === "PUBLISHED" ? new Date() : null, fileKey: primary.fileKey, fileUrl: primary.fileUrl, fileSize: primary.fileSize, mimeType: primary.mimeType, attachments: { create: attachments.value.map((item, sortOrder) => ({ ...item, sortOrder })) } }, select: { id: true, title: true } });
      await tx.auditLog.create({ data: { userId: null, villageId: context.villageId, action: AuditAction.CREATE, resource: "DownloadFile", resourceId: file.id, metadata: { actorRole: "SUPERADMIN", actorType: "SUPERADMIN_ENV", actionName: "DOWNLOAD_CREATED", supportReason: reason, stage, visibility: normalized.value.visibility } } });
      await notifyVillageAdministrationOfSuperAdminIntervention(tx, { villageId: context.villageId, actionLabel: "เพิ่มเอกสารดาวน์โหลด", supportReason: reason, targetType: "DownloadFile", targetId: file.id, targetName: file.title, actionUrl: `/admin/downloads/${file.id}`, metadata: { fileId: file.id, stage } });
      return file;
    });
    if (stage === "PUBLISHED") await notifyResidents(context.villageId, "เอกสารดาวน์โหลดใหม่", `เอกสาร ${created.title} พร้อมให้ดาวน์โหลดแล้ว`, created.id);
    refresh(context.villageId, created.id); return { success: true, id: created.id };
  } catch (error) { return invalid(error instanceof Error ? error.message : "ไม่สามารถเพิ่มเอกสารได้"); }
}

export async function superAdminUpdateDownloadAction(villageId: string, fileId: string, data: DownloadFormInput, reasonInput: string): Promise<DownloadActionResult> {
  try {
    const context = await requireSuperAdminVillageContext(villageId); const reason = requireSupportReason(reasonInput); const normalized = normalize(data); if (!normalized.ok) return normalized.result;
    const existing = await prisma.downloadFile.findFirst({ where: { id: fileId, villageId: context.villageId }, include: { attachments: { orderBy: { sortOrder: "asc" } } } }); if (!existing) return invalid("ไม่พบเอกสารในหมู่บ้านนี้");
    const attachments = await resolveAttachments(normalized.value.attachments, existing.attachments, context.villageId); if (!attachments.ok) return attachments.result;
    const primary = attachments.value[0]; const existingIds = new Set(existing.attachments.map((item) => item.id));
    await prisma.$transaction(async (tx) => {
      await tx.downloadFile.update({ where: { id: existing.id }, data: { title: normalized.value.title, description: normalized.value.description || null, category: normalized.value.category, categoryLabel: normalized.value.category === "OTHER" ? normalized.value.categoryLabel : null, visibility: normalized.value.visibility as NewsVisibility, fileKey: primary.fileKey, fileUrl: primary.fileUrl, fileSize: primary.fileSize, mimeType: primary.mimeType } });
      const retained = attachments.value.flatMap((item) => item.id ? [item.id] : []); await tx.downloadAttachment.deleteMany({ where: { downloadId: existing.id, id: { notIn: retained } } });
      for (const [sortOrder, item] of attachments.value.entries()) if (item.id && existingIds.has(item.id)) await tx.downloadAttachment.update({ where: { id: item.id }, data: { sortOrder } }); else await tx.downloadAttachment.create({ data: { downloadId: existing.id, ...item, sortOrder } });
      await tx.auditLog.create({ data: { userId: null, villageId: context.villageId, action: AuditAction.UPDATE, resource: "DownloadFile", resourceId: existing.id, metadata: { actorRole: "SUPERADMIN", actorType: "SUPERADMIN_ENV", actionName: "DOWNLOAD_UPDATED", supportReason: reason, title: existing.title, newTitle: normalized.value.title, oldVisibility: existing.visibility, newVisibility: normalized.value.visibility } } });
      await notifyVillageAdministrationOfSuperAdminIntervention(tx, { villageId: context.villageId, actionLabel: "แก้ไขเอกสารดาวน์โหลด", supportReason: reason, targetType: "DownloadFile", targetId: existing.id, targetName: normalized.value.title, actionUrl: `/admin/downloads/${existing.id}`, metadata: { fileId: existing.id } });
    });
    if (existing.stage === "PUBLISHED" && (attachments.value.length !== existing.attachments.length || attachments.removedKeys.length > 0 || attachments.value.some((item) => !item.id))) await notifyResidents(context.villageId, "เอกสารดาวน์โหลดมีการอัปเดต", `เอกสาร ${normalized.value.title} มีการอัปเดตไฟล์แนบ`, existing.id);
    void deleteDownloadUploads(attachments.removedKeys); refresh(context.villageId, existing.id); return { success: true, id: existing.id };
  } catch (error) { return invalid(error instanceof Error ? error.message : "ไม่สามารถแก้ไขเอกสารได้"); }
}

export async function superAdminTransitionDownloadAction(villageId: string, fileId: string, nextStage: DownloadStage, reasonInput: string): Promise<DownloadActionResult> {
  try {
    const context = await requireSuperAdminVillageContext(villageId); const reason = requireSupportReason(reasonInput); const existing = await prisma.downloadFile.findFirst({ where: { id: fileId, villageId: context.villageId }, select: { id: true, title: true, stage: true } }); if (!existing) return invalid("ไม่พบเอกสารในหมู่บ้านนี้");
    const valid = (nextStage === "PUBLISHED" && ["DRAFT", "ARCHIVED"].includes(existing.stage)) || (nextStage === "ARCHIVED" && existing.stage === "PUBLISHED") || (nextStage === "DRAFT" && existing.stage === "ARCHIVED"); if (!valid) return invalid("ไม่สามารถเปลี่ยนสถานะเอกสารนี้ได้");
    await prisma.$transaction(async (tx) => { await tx.downloadFile.update({ where: { id: existing.id }, data: { stage: nextStage, ...(nextStage === "PUBLISHED" ? { publishedAt: new Date() } : {}) } }); await tx.auditLog.create({ data: { userId: null, villageId: context.villageId, action: AuditAction.UPDATE, resource: "DownloadFile", resourceId: existing.id, metadata: { actorRole: "SUPERADMIN", actorType: "SUPERADMIN_ENV", actionName: "DOWNLOAD_STAGE_CHANGED", supportReason: reason, oldStage: existing.stage, newStage: nextStage } } }); await notifyVillageAdministrationOfSuperAdminIntervention(tx, { villageId: context.villageId, actionLabel: nextStage === "PUBLISHED" ? "เผยแพร่เอกสารดาวน์โหลด" : nextStage === "ARCHIVED" ? "จัดเก็บเอกสารดาวน์โหลด" : "คืนเอกสารเป็นร่าง", supportReason: reason, targetType: "DownloadFile", targetId: existing.id, targetName: existing.title, actionUrl: `/admin/downloads/${existing.id}`, metadata: { fileId: existing.id, oldStage: existing.stage, newStage: nextStage } }); });
    if (nextStage === "PUBLISHED") await notifyResidents(context.villageId, "เอกสารดาวน์โหลดพร้อมใช้งาน", `เอกสาร ${existing.title} พร้อมให้ดาวน์โหลดแล้ว`, existing.id); refresh(context.villageId, existing.id); return { success: true, id: existing.id };
    return { success: true, id: existing.id };
  } catch (error) { return invalid(error instanceof Error ? error.message : "ไม่สามารถเปลี่ยนสถานะเอกสารได้"); }
}

export async function superAdminDeleteDownloadAction(villageId: string, fileId: string, reasonInput: string): Promise<DownloadActionResult> {
  try {
    const context = await requireSuperAdminVillageContext(villageId); const reason = requireSupportReason(reasonInput); const existing = await prisma.downloadFile.findFirst({ where: { id: fileId, villageId: context.villageId }, include: { attachments: { select: { fileKey: true } } } }); if (!existing) return invalid("ไม่พบเอกสารในหมู่บ้านนี้");
    await prisma.$transaction(async (tx) => { await tx.savedItem.deleteMany({ where: { downloadId: existing.id } }); await tx.downloadFile.delete({ where: { id: existing.id } }); await tx.auditLog.create({ data: { userId: null, villageId: context.villageId, action: AuditAction.DELETE, resource: "DownloadFile", resourceId: existing.id, metadata: { actorRole: "SUPERADMIN", actorType: "SUPERADMIN_ENV", actionName: "DOWNLOAD_DELETED", supportReason: reason, title: existing.title } } }); await notifyVillageAdministrationOfSuperAdminIntervention(tx, { villageId: context.villageId, actionLabel: "ลบเอกสารดาวน์โหลด", supportReason: reason, targetType: "DownloadFile", targetId: existing.id, targetName: existing.title, actionUrl: "/admin/downloads", metadata: { fileId: existing.id } }); });
    void deleteDownloadUploads(existing.attachments.map((item) => item.fileKey).filter((value): value is string => Boolean(value))); refresh(context.villageId); return { success: true };
  } catch (error) { return invalid(error instanceof Error ? error.message : "ไม่สามารถลบเอกสารได้"); }
}
