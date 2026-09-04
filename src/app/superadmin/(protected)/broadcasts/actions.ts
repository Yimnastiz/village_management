"use server";

import { AuditAction, NotificationType } from "@prisma/client";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminActionSession } from "@/lib/superadmin";

const MAX_CUSTOM_DURATION_MINUTES = 365 * 24 * 60;
const NOTIFICATION_BATCH_SIZE = 1_000;
type BroadcastMetadata = { source: "SUPERADMIN_BROADCAST"; broadcastGroupId: string; expiresAt: string | null };

function readText(formData: FormData, key: string) { const value = formData.get(key); return typeof value === "string" ? value.trim() : ""; }
function metadata(id: string, expiresAt: Date | null): BroadcastMetadata { return { source: "SUPERADMIN_BROADCAST", broadcastGroupId: id, expiresAt: expiresAt?.toISOString() ?? null }; }
function revalidateBroadcastPaths() { ["/superadmin/broadcasts", "/superadmin/dashboard", "/resident/news", "/resident/notifications", "/admin/news", "/admin/notifications"].forEach((path) => revalidatePath(path)); }

function expiresAtFromForm(formData: FormData, currentExpiresAt?: Date | null) {
  const mode = readText(formData, "expiryMode");
  const presetMinutes: Record<string, number> = { ONE_HOUR: 60, ONE_DAY: 1_440, THREE_DAYS: 4_320, SEVEN_DAYS: 10_080 };
  if (mode === "PRESERVE" && currentExpiresAt !== undefined) return currentExpiresAt;
  if (mode === "NEVER") return null;
  if (presetMinutes[mode]) return new Date(Date.now() + presetMinutes[mode] * 60_000);
  if (mode !== "CUSTOM") throw new Error("ระยะเวลาประกาศไม่ถูกต้อง");
  const rawValue = readText(formData, "customValue"); const value = Number(rawValue); const unit = readText(formData, "customUnit");
  if (!/^\d+$/.test(rawValue) || !Number.isSafeInteger(value) || value < 1 || !["MINUTES", "HOURS"].includes(unit)) throw new Error("กรุณากำหนดระยะเวลาที่เป็นจำนวนเต็มอย่างน้อย 1 นาที");
  const minutes = unit === "HOURS" ? value * 60 : value;
  if (!Number.isSafeInteger(minutes) || minutes > MAX_CUSTOM_DURATION_MINUTES) throw new Error("ระยะเวลาประกาศยาวเกินกำหนด");
  return new Date(Date.now() + minutes * 60_000);
}

function assertText(formData: FormData) {
  const title = readText(formData, "title"); const body = readText(formData, "body");
  if (!title || !body) throw new Error("กรุณากรอกหัวข้อและเนื้อหาประกาศ");
  return { title, body };
}

export async function broadcastAnnouncementAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();
  const { title, body } = assertText(formData); const expiresAt = expiresAtFromForm(formData); const id = randomUUID();
  const recipients = await prisma.villageMembership.findMany({ where: { status: "ACTIVE" }, distinct: ["userId"], select: { userId: true } });
  if (!recipients.length) throw new Error("ไม่พบผู้ใช้ที่มีสมาชิกหมู่บ้านแบบใช้งานอยู่");
  const deliveryMetadata = metadata(id, expiresAt);
  await prisma.$transaction(async (tx) => {
    await tx.systemBroadcast.create({ data: { id, title, body, expiresAt, audienceCount: recipients.length, createdByUserId: session.id } });
    for (let index = 0; index < recipients.length; index += NOTIFICATION_BATCH_SIZE) {
      await tx.notification.createMany({ data: recipients.slice(index, index + NOTIFICATION_BATCH_SIZE).map(({ userId }) => ({ userId, systemBroadcastId: id, type: NotificationType.SYSTEM, title, body, metadata: deliveryMetadata })) });
    }
    await tx.auditLog.create({ data: { userId: session.id, action: AuditAction.CREATE, resource: "SystemWideBroadcast", resourceId: id, metadata: { title, audienceCount: recipients.length, expiresAt: expiresAt?.toISOString() ?? null, actorType: "SUPERADMIN_ENV" } } });
  }, { timeout: 60_000 });
  revalidateBroadcastPaths();
}

export async function updateBroadcastAnnouncementAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();
  const id = readText(formData, "broadcastGroupId"); const { title, body } = assertText(formData);
  if (!id) throw new Error("ไม่พบประกาศที่ต้องการแก้ไข");
  const current = await prisma.systemBroadcast.findUnique({ where: { id }, select: { status: true, expiresAt: true } });
  if (!current || current.status !== "ACTIVE" || (current.expiresAt && current.expiresAt <= new Date())) throw new Error("ไม่สามารถแก้ไขประกาศที่ไม่กำลังแสดงอยู่");
  const expiresAt = expiresAtFromForm(formData, current.expiresAt);
  await prisma.$transaction(async (tx) => {
    await tx.systemBroadcast.update({ where: { id }, data: { title, body, expiresAt } });
    await tx.notification.updateMany({ where: { systemBroadcastId: id, type: NotificationType.SYSTEM, status: { in: ["UNREAD", "READ"] } }, data: { title, body, metadata: metadata(id, expiresAt) } });
    await tx.auditLog.create({ data: { userId: session.id, action: AuditAction.UPDATE, resource: "SystemWideBroadcast", resourceId: id, metadata: { title, expiresAt: expiresAt?.toISOString() ?? null, actorType: "SUPERADMIN_ENV" } } });
  }, { timeout: 60_000 });
  revalidateBroadcastPaths();
}

export async function archiveBroadcastAnnouncementAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();
  const id = readText(formData, "broadcastGroupId"); if (!id) throw new Error("ไม่พบประกาศที่ต้องการยกเลิก");
  const current = await prisma.systemBroadcast.findUnique({ where: { id }, select: { status: true, expiresAt: true } });
  if (!current || current.status !== "ACTIVE" || (current.expiresAt && current.expiresAt <= new Date())) throw new Error("ไม่สามารถยกเลิกประกาศที่ไม่กำลังแสดงอยู่");
  const cancelledAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.systemBroadcast.update({ where: { id }, data: { status: "CANCELLED", cancelledAt } });
    const result = await tx.notification.updateMany({ where: { systemBroadcastId: id, type: NotificationType.SYSTEM, status: { in: ["UNREAD", "READ"] } }, data: { status: "ARCHIVED" } });
    await tx.auditLog.create({ data: { userId: session.id, action: AuditAction.DELETE, resource: "SystemWideBroadcast", resourceId: id, metadata: { archivedNotifications: result.count, cancelledAt: cancelledAt.toISOString(), actorType: "SUPERADMIN_ENV" } } });
  }, { timeout: 60_000 });
  revalidateBroadcastPaths();
}
