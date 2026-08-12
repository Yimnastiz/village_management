import type { Notification, Prisma } from "@prisma/client";

type NotificationMetadata = Record<string, Prisma.JsonValue | undefined>;

function metadataOf(notification: Pick<Notification, "metadata">): NotificationMetadata {
  return notification.metadata && typeof notification.metadata === "object" && !Array.isArray(notification.metadata)
    ? (notification.metadata as NotificationMetadata)
    : {};
}

function stringValue(metadata: NotificationMetadata, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Resolves only internal resident destinations from structured metadata. */
export function resolveResidentNotificationDestination(notification: Pick<Notification, "id" | "type" | "metadata">): string | null {
  const metadata = metadataOf(notification);
  const source = stringValue(metadata, "source");
  const explicitUrl = stringValue(metadata, "actionUrl");
  if (notification.type === "BINDING_REQUEST") {
    const action = stringValue(metadata, "action")?.toLowerCase();
    if (action === "approve" || action === "approved") return "/resident/dashboard?from=notifications";
    return "/resident/binding/pending?from=notifications";
  }
  if (explicitUrl?.startsWith("/resident/")) return explicitUrl;
  if (notification.type === "SYSTEM" && source === "SUPERADMIN_BROADCAST") return `/resident/notifications/${notification.id}`;

  const appointmentId = stringValue(metadata, "appointmentId");
  const issueId = stringValue(metadata, "issueId");
  const newsId = stringValue(metadata, "newsId");
  const fileId = stringValue(metadata, "fileId");
  const albumId = stringValue(metadata, "albumId");
  const transparencyId = stringValue(metadata, "transparencyId");
  const correctionRequestId = stringValue(metadata, "correctionRequestId");
  const requestId = stringValue(metadata, "requestId") ?? stringValue(metadata, "submissionId");
  if (appointmentId) return `/resident/appointments/${appointmentId}`;
  if (issueId) return `/resident/issues/${issueId}`;
  if (newsId) return `/resident/news/${newsId}`;
  if (fileId) return `/resident/downloads/${fileId}`;
  if (albumId) return `/resident/gallery/${albumId}`;
  if (transparencyId) return `/resident/transparency/${transparencyId}`;
  if (correctionRequestId) return `/resident/household/corrections/${correctionRequestId}`;
  if (source?.includes("CALENDAR") && requestId) return `/resident/calendar/requests/${requestId}`;
  if (notification.type === "APPOINTMENT_UPDATE") return "/resident/appointments";
  if (notification.type === "ISSUE_UPDATE") return "/resident/issues";
  if (notification.type === "NEWS") return requestId ? `/resident/news/requests/${requestId}` : "/resident/news";
  if (notification.type === "CORRECTION_REQUEST") return "/resident/household/corrections";
  return null;
}
