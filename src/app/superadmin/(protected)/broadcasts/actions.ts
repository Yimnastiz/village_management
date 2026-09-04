"use server";

import { AuditAction, NotificationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminActionSession, writeSuperAdminAuditLog } from "@/lib/superadmin";

const MAX_CUSTOM_DURATION_MINUTES = 365 * 24 * 60;
const NOTIFICATION_BATCH_SIZE = 1_000;
type BroadcastMetadata = { source: "SUPERADMIN_BROADCAST"; broadcastGroupId: string; expiresAt: string | null };

function readText(formData: FormData, key: string) { const value = formData.get(key); return typeof value === "string" ? value.trim() : ""; }
function parseMetadata(input: unknown): BroadcastMetadata | null {
  if (!input || typeof input !== "object") return null;
  const metadata = input as Record<string, unknown>;
  if (metadata.source !== "SUPERADMIN_BROADCAST" || typeof metadata.broadcastGroupId !== "string" || !metadata.broadcastGroupId.trim()) return null;
  return { source: "SUPERADMIN_BROADCAST", broadcastGroupId: metadata.broadcastGroupId.trim(), expiresAt: typeof metadata.expiresAt === "string" && metadata.expiresAt.trim() ? metadata.expiresAt : null };
}
function buildMetadata(groupId: string, expiresAt: Date | null): BroadcastMetadata { return { source: "SUPERADMIN_BROADCAST", broadcastGroupId: groupId, expiresAt: expiresAt?.toISOString() ?? null }; }
function computeExpiresAt(formData: FormData, currentExpiresAt?: string | null): Date | null {
  const expiryMode = readText(formData, "expiryMode"); const now = new Date();
  const presetDurations: Record<string, number> = { ONE_HOUR: 60, ONE_DAY: 24 * 60, THREE_DAYS: 3 * 24 * 60, SEVEN_DAYS: 7 * 24 * 60 };
  if (expiryMode === "PRESERVE" && currentExpiresAt !== undefined) return currentExpiresAt ? new Date(currentExpiresAt) : null;
  if (expiryMode === "NEVER") return null;
  if (presetDurations[expiryMode]) return new Date(now.getTime() + presetDurations[expiryMode] * 60 * 1000);
  if (expiryMode !== "CUSTOM") throw new Error("ระยะเวลาประกาศไม่ถูกต้อง");
  const rawValue = readText(formData, "customValue"); const customValue = Number(rawValue); const unit = readText(formData, "customUnit");
  if (!/^\d+$/.test(rawValue) || !Number.isSafeInteger(customValue) || customValue < 1 || (unit !== "MINUTES" && unit !== "HOURS")) throw new Error("กรุณากำหนดระยะเวลาที่เป็นจำนวนเต็มอย่างน้อย 1 นาที");
  const durationMinutes = unit === "HOURS" ? customValue * 60 : customValue;
  if (!Number.isSafeInteger(durationMinutes) || durationMinutes > MAX_CUSTOM_DURATION_MINUTES) throw new Error("ระยะเวลาประกาศยาวเกินกำหนด");
  return new Date(now.getTime() + durationMinutes * 60 * 1000);
}
function revalidateBroadcastPaths() { ["/superadmin/broadcasts", "/superadmin/dashboard", "/resident/news", "/resident/notifications", "/admin/news", "/admin/notifications"].forEach((path) => revalidatePath(path)); }

export async function broadcastAnnouncementAction(formData: FormData) {
  await requireSuperAdminActionSession(); const title = readText(formData, "title"); const body = readText(formData, "body");
  if (!title || !body) throw new Error("กรุณากรอกหัวข้อและเนื้อหาประกาศ");
  const expiresAt = computeExpiresAt(formData); const groupId = randomUUID();
  const recipients = await prisma.villageMembership.findMany({ where: { status: "ACTIVE" }, distinct: ["userId"], select: { userId: true } });
  if (!recipients.length) throw new Error("ไม่พบผู้ใช้ที่มีสมาชิกหมู่บ้านแบบใช้งานอยู่");
  const metadata = buildMetadata(groupId, expiresAt);
  for (let index = 0; index < recipients.length; index += NOTIFICATION_BATCH_SIZE) await prisma.notification.createMany({ data: recipients.slice(index, index + NOTIFICATION_BATCH_SIZE).map(({ userId }) => ({ userId, type: NotificationType.SYSTEM, title, body, metadata })) });
  await writeSuperAdminAuditLog({ action: AuditAction.CREATE, resource: "SystemWideBroadcast", resourceId: groupId, metadata: { title, notifiedUsers: recipients.length, expiresAt: expiresAt?.toISOString() ?? null } });
  revalidateBroadcastPaths();
}
export async function updateBroadcastAnnouncementAction(formData: FormData) {
  await requireSuperAdminActionSession(); const groupId = readText(formData, "broadcastGroupId"); const title = readText(formData, "title"); const body = readText(formData, "body");
  if (!groupId || !title || !body) throw new Error("ข้อมูลประกาศไม่ครบถ้วน");
  const existing = await prisma.notification.findFirst({ where: { type: NotificationType.SYSTEM, status: { in: ["UNREAD", "READ"] }, metadata: { path: ["broadcastGroupId"], equals: groupId } }, select: { metadata: true } });
  const parsed = parseMetadata(existing?.metadata);
  if (!parsed) throw new Error("ไม่พบประกาศที่กำลังแสดงอยู่");
  if (parsed.expiresAt && new Date(parsed.expiresAt) <= new Date()) throw new Error("ไม่สามารถแก้ไขประกาศที่หมดอายุแล้ว");
  const expiresAt = computeExpiresAt(formData, parsed.expiresAt);
  await prisma.notification.updateMany({ where: { type: NotificationType.SYSTEM, status: { in: ["UNREAD", "READ"] }, metadata: { path: ["broadcastGroupId"], equals: groupId } }, data: { title, body, metadata: buildMetadata(groupId, expiresAt) } });
  await writeSuperAdminAuditLog({ action: AuditAction.UPDATE, resource: "SystemWideBroadcast", resourceId: groupId, metadata: { title, expiresAt: expiresAt?.toISOString() ?? null } }); revalidateBroadcastPaths();
}
export async function archiveBroadcastAnnouncementAction(formData: FormData) {
  await requireSuperAdminActionSession(); const groupId = readText(formData, "broadcastGroupId"); if (!groupId) throw new Error("ไม่พบประกาศที่ต้องการยกเลิก");
  const result = await prisma.notification.updateMany({ where: { type: NotificationType.SYSTEM, status: { in: ["UNREAD", "READ"] }, metadata: { path: ["broadcastGroupId"], equals: groupId } }, data: { status: "ARCHIVED" } });
  if (!result.count) throw new Error("ไม่พบประกาศที่ต้องการยกเลิก");
  await writeSuperAdminAuditLog({ action: AuditAction.DELETE, resource: "SystemWideBroadcast", resourceId: groupId, metadata: { archivedNotifications: result.count } }); revalidateBroadcastPaths();
}
