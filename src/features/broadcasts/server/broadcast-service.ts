import "server-only";

import { AuditAction, NotificationStatus, NotificationType, Prisma, SystemBroadcastStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

export const VILLAGE_BROADCAST_SOURCE = "VILLAGE_BROADCAST";
export const LEGACY_SUPERADMIN_BROADCAST_SOURCE = "SUPERADMIN_BROADCAST";
export const BROADCAST_SOURCES = [VILLAGE_BROADCAST_SOURCE, LEGACY_SUPERADMIN_BROADCAST_SOURCE] as const;
const MAX_CUSTOM_DURATION_MINUTES = 365 * 24 * 60;
const BATCH_SIZE = 1_000;
type Metadata = { source: typeof VILLAGE_BROADCAST_SOURCE; broadcastGroupId: string; expiresAt: string | null };

function text(formData: FormData, key: string) { const value = formData.get(key); return typeof value === "string" ? value.trim() : ""; }
function details(formData: FormData) { const title = text(formData, "title"); const body = text(formData, "body"); if (!title || !body) throw new Error("กรุณากรอกหัวข้อและเนื้อหาประกาศ"); return { title, body }; }
function expiry(formData: FormData, current?: Date | null) {
  const mode = text(formData, "expiryMode"); const presets: Record<string, number> = { ONE_HOUR: 60, ONE_DAY: 1_440, THREE_DAYS: 4_320, SEVEN_DAYS: 10_080 };
  if (mode === "PRESERVE" && current !== undefined) return current; if (mode === "NEVER") return null; if (presets[mode]) return new Date(Date.now() + presets[mode] * 60_000);
  const raw = text(formData, "customValue"); const value = Number(raw); const unit = text(formData, "customUnit");
  if (mode !== "CUSTOM" || !/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < 1 || !["MINUTES", "HOURS", "DAYS"].includes(unit)) throw new Error("กรุณากำหนดระยะเวลาเป็นจำนวนเต็มมากกว่า 0");
  const minutes = unit === "DAYS" ? value * 24 * 60 : unit === "HOURS" ? value * 60 : value; if (!Number.isSafeInteger(minutes) || minutes > MAX_CUSTOM_DURATION_MINUTES) throw new Error("ระยะเวลาประกาศยาวเกินกำหนด"); return new Date(Date.now() + minutes * 60_000);
}
function metadata(id: string, expiresAt: Date | null): Metadata { return { source: VILLAGE_BROADCAST_SOURCE, broadcastGroupId: id, expiresAt: expiresAt?.toISOString() ?? null }; }

/** Recipient selection is intentionally village-local and distinct by user. The
 * creating Headman is included when they hold an active target membership, so
 * their admin ticker stays an accurate preview of the live announcement. */
async function recipients(villageId: string) {
  return prisma.villageMembership.findMany({ where: { villageId, status: "ACTIVE" }, distinct: ["userId"], select: { userId: true } });
}

export async function createVillageBroadcast(formData: FormData, context: { userId: string; villageId: string; actorRole: string }) {
  const { title, body } = details(formData); const expiresAt = expiry(formData); const audience = await recipients(context.villageId);
  if (!audience.length) throw new Error("ยังไม่มีสมาชิกที่สามารถรับประกาศได้");
  const id = randomUUID(); const delivery = metadata(id, expiresAt);
  await prisma.$transaction(async (tx) => {
    await tx.systemBroadcast.create({ data: { id, villageId: context.villageId, title, body, expiresAt, audienceCount: audience.length, createdByUserId: context.userId } });
    for (let start = 0; start < audience.length; start += BATCH_SIZE) await tx.notification.createMany({ data: audience.slice(start, start + BATCH_SIZE).map(({ userId }) => ({ userId, villageId: context.villageId, systemBroadcastId: id, type: NotificationType.SYSTEM, title, body, metadata: delivery })) });
    await tx.auditLog.create({ data: { userId: context.userId, villageId: context.villageId, action: AuditAction.CREATE, resource: "VillageBroadcast", resourceId: id, metadata: { actorRole: context.actorRole, title, audienceCount: audience.length, expiresAt: expiresAt?.toISOString() ?? null } } });
  }, { timeout: 60_000 });
  return id;
}

async function ownedActiveBroadcast(id: string, villageId: string) {
  const row = await prisma.systemBroadcast.findFirst({ where: { id, villageId }, select: { id: true, status: true, expiresAt: true } });
  if (!row || row.status !== SystemBroadcastStatus.ACTIVE || (row.expiresAt && row.expiresAt <= new Date())) throw new Error("ไม่สามารถดำเนินการกับประกาศนี้ได้");
  return row;
}

export async function updateVillageBroadcast(formData: FormData, context: { userId: string; villageId: string; actorRole: string }) {
  const id = text(formData, "broadcastGroupId"); if (!id) throw new Error("ไม่พบประกาศที่ต้องการแก้ไข"); const { title, body } = details(formData); const current = await ownedActiveBroadcast(id, context.villageId); const expiresAt = expiry(formData, current.expiresAt);
  await prisma.$transaction(async (tx) => {
    await tx.systemBroadcast.update({ where: { id }, data: { title, body, expiresAt } });
    await tx.notification.updateMany({ where: { systemBroadcastId: id, villageId: context.villageId, type: NotificationType.SYSTEM, status: { in: [NotificationStatus.UNREAD, NotificationStatus.READ] } }, data: { title, body, metadata: metadata(id, expiresAt) } });
    await tx.auditLog.create({ data: { userId: context.userId, villageId: context.villageId, action: AuditAction.UPDATE, resource: "VillageBroadcast", resourceId: id, metadata: { actorRole: context.actorRole, title, expiresAt: expiresAt?.toISOString() ?? null } } });
  }, { timeout: 60_000 });
}

export async function cancelVillageBroadcast(formData: FormData, context: { userId: string; villageId: string; actorRole: string }) {
  const id = text(formData, "broadcastGroupId"); if (!id) throw new Error("ไม่พบประกาศที่ต้องการยกเลิก"); await ownedActiveBroadcast(id, context.villageId); const cancelledAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.systemBroadcast.update({ where: { id }, data: { status: SystemBroadcastStatus.CANCELLED, cancelledAt } });
    const result = await tx.notification.updateMany({ where: { systemBroadcastId: id, villageId: context.villageId, type: NotificationType.SYSTEM, status: { in: [NotificationStatus.UNREAD, NotificationStatus.READ] } }, data: { status: NotificationStatus.ARCHIVED } });
    await tx.auditLog.create({ data: { userId: context.userId, villageId: context.villageId, action: AuditAction.DELETE, resource: "VillageBroadcast", resourceId: id, metadata: { actorRole: context.actorRole, archivedNotifications: result.count, cancelledAt: cancelledAt.toISOString() } } });
  }, { timeout: 60_000 });
}

export async function listVillageBroadcasts(villageId: string, q: string, status: string, page: number) {
  const now = new Date(); const where: Prisma.SystemBroadcastWhereInput = { villageId, AND: [
    ...(q ? [{ OR: [{ title: { contains: q, mode: "insensitive" as const } }, { body: { contains: q, mode: "insensitive" as const } }] }] : []),
    ...(status === "active" ? [{ status: SystemBroadcastStatus.ACTIVE, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] : status === "expired" ? [{ status: SystemBroadcastStatus.ACTIVE, expiresAt: { lte: now } }] : status === "cancelled" ? [{ status: SystemBroadcastStatus.CANCELLED }] : []),
  ] };
  const [rows, total] = await Promise.all([prisma.systemBroadcast.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 15, take: 15, include: { createdBy: { select: { name: true } } } }), prisma.systemBroadcast.count({ where })]);
  return { rows, total, now };
}
