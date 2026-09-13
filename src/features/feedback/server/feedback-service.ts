import "server-only";

import { NotificationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Feedback is represented by a PUBLIC_FEEDBACK Notification.  These legacy
 * records are deployment-global; their `userId` is the former inbox recipient,
 * not the public sender, and submitted rows have no villageId. */
export const FEEDBACK_SOURCE = "PUBLIC_FEEDBACK";
export const FEEDBACK_STATUSES = [NotificationStatus.UNREAD, NotificationStatus.READ, NotificationStatus.ARCHIVED] as const;
export const FEEDBACK_CATEGORIES = ["suggestion", "complaint", "bug", "other"] as const;
export type FeedbackStatusFilter = "active" | "all" | NotificationStatus;

export function isFeedbackMetadata(metadata: Prisma.JsonValue | null) {
  return Boolean(metadata && typeof metadata === "object" && !Array.isArray(metadata) && (metadata as Record<string, unknown>).source === FEEDBACK_SOURCE);
}

export function feedbackMetadataString(metadata: Prisma.JsonValue | null, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function normalizeFeedbackStatus(value?: string): FeedbackStatusFilter {
  if (value === "active" || value === "all") return value;
  return FEEDBACK_STATUSES.includes(value as NotificationStatus) ? value as NotificationStatus : "active";
}

export function normalizeFeedbackPage(value?: string) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export async function getFeedbackById(notificationId: string, villageId?: string) {
  const row = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { id: true, villageId: true, title: true, body: true, status: true, readAt: true, createdAt: true, metadata: true },
  });
  return row && isFeedbackMetadata(row.metadata) && (!villageId || row.villageId === null || row.villageId === villageId) ? row : null;
}

export async function listFeedback({ q = "", category = "all", status = "all", sort = "newest", page = 1, villageId }: { q?: string; category?: string; status?: FeedbackStatusFilter; sort?: "newest" | "oldest"; page?: number; villageId?: string }) {
  const keyword = q.trim();
  const where: Prisma.NotificationWhereInput = { AND: [
    { metadata: { path: ["source"], equals: FEEDBACK_SOURCE } },
    ...(villageId ? [{ OR: [{ villageId }, { villageId: null }] }] : []),
    ...(FEEDBACK_CATEGORIES.includes(category as typeof FEEDBACK_CATEGORIES[number]) ? [{ metadata: { path: ["category"], equals: category } }] : []),
    ...(status === "active" ? [{ status: { in: [NotificationStatus.UNREAD, NotificationStatus.READ] } }] : status !== "all" ? [{ status }] : []),
    ...(keyword ? [{ OR: [
      { title: { contains: keyword, mode: "insensitive" } }, { body: { contains: keyword, mode: "insensitive" } },
      { metadata: { path: ["name"], string_contains: keyword } }, { metadata: { path: ["email"], string_contains: keyword } },
    ] } as Prisma.NotificationWhereInput] : []),
  ] };
  const total = await prisma.notification.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const rows = await prisma.notification.findMany({ where, orderBy: [{ createdAt: sort === "oldest" ? "asc" : "desc" }, { id: sort === "oldest" ? "asc" : "desc" }], skip: (currentPage - 1) * 20, take: 20, select: { id: true, title: true, body: true, status: true, createdAt: true, metadata: true } });
  return { total, totalPages, currentPage, rows };
}

export async function markFeedbackAsReadIfUnread(notificationId: string, villageId?: string) {
  const row = await getFeedbackById(notificationId, villageId);
  if (!row || row.status !== NotificationStatus.UNREAD) return row;
  await prisma.notification.updateMany({ where: { id: row.id, status: NotificationStatus.UNREAD }, data: { status: NotificationStatus.READ, readAt: new Date() } });
  return getFeedbackById(notificationId, villageId);
}

export async function transitionFeedback(notificationId: string, operation: "unread" | "archive" | "restore", villageId?: string) {
  const row = await getFeedbackById(notificationId, villageId);
  if (!row) throw new Error("ไม่พบรายการความคิดเห็น");
  if (operation === "restore") {
    if (row.status !== NotificationStatus.ARCHIVED) throw new Error("รายการนี้ยังไม่ได้จัดเก็บ");
    const status = row.readAt ? NotificationStatus.READ : NotificationStatus.UNREAD;
    const result = await prisma.notification.updateMany({ where: { id: row.id, status: NotificationStatus.ARCHIVED }, data: { status } });
    if (!result.count) throw new Error("สถานะรายการถูกเปลี่ยนแล้ว");
    return status;
  }
  if (row.status === NotificationStatus.ARCHIVED) throw new Error("ไม่สามารถเปลี่ยนสถานะรายการที่จัดเก็บแล้ว");
  const status = operation === "archive" ? NotificationStatus.ARCHIVED : NotificationStatus.UNREAD;
  const result = await prisma.notification.updateMany({ where: { id: row.id, status: row.status }, data: { status, ...(operation === "unread" ? { readAt: null } : {}) } });
  if (!result.count) throw new Error("สถานะรายการถูกเปลี่ยนแล้ว");
  return status;
}
