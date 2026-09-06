import { NotificationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const FEEDBACK_SOURCE = "PUBLIC_FEEDBACK";

export function isFeedbackMetadata(metadata: Prisma.JsonValue | null) {
  return Boolean(metadata && typeof metadata === "object" && !Array.isArray(metadata) && (metadata as Record<string, unknown>).source === FEEDBACK_SOURCE);
}

export async function getFeedbackById(notificationId: string) {
  const row = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { id: true, title: true, body: true, status: true, readAt: true, createdAt: true, metadata: true },
  });
  return row && isFeedbackMetadata(row.metadata) ? row : null;
}

export async function markFeedbackAsReadIfUnread(notificationId: string) {
  const row = await getFeedbackById(notificationId);
  if (!row || row.status !== NotificationStatus.UNREAD) return row;

  await prisma.notification.updateMany({
    where: { id: row.id, status: NotificationStatus.UNREAD },
    data: { status: NotificationStatus.READ, readAt: new Date() },
  });

  return getFeedbackById(notificationId);
}
