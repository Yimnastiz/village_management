import type { Notification, NotificationType, Prisma } from "@prisma/client";

type NotificationMetadata = Record<string, Prisma.JsonValue | undefined>;

function metadataOf(notification: Pick<Notification, "metadata">): NotificationMetadata {
  return notification.metadata && typeof notification.metadata === "object" && !Array.isArray(notification.metadata)
    ? (notification.metadata as NotificationMetadata)
    : {};
}

function stringValue(metadata: NotificationMetadata, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Resolves a destination from structured notification metadata.  Keep this in
 * one place so a notification always opens the most specific admin resource.
 */
export function resolveAdminNotificationDestination(
  notification: Pick<Notification, "type" | "metadata">
): string | null {
  const metadata = metadataOf(notification);
  const bindingRequestId = stringValue(metadata, "bindingRequestId");
  const requestId = stringValue(metadata, "requestId") ?? stringValue(metadata, "submissionId");
  const newsId = stringValue(metadata, "newsId");
  const eventId = stringValue(metadata, "eventId");
  const appointmentId = stringValue(metadata, "appointmentId");
  const issueId = stringValue(metadata, "issueId");
  const gallerySubmissionId = stringValue(metadata, "submissionId");
  const albumId = stringValue(metadata, "albumId");
  const contactId = stringValue(metadata, "contactId");
  const placeId = stringValue(metadata, "placeId");
  const source = stringValue(metadata, "source");
  const action = stringValue(metadata, "action");

  const fromNotifications = (path: string) => `${path}${path.includes("?") ? "&" : "?"}from=notifications`;
  if (action?.includes("ISSUE_DELETED")) return "/admin/issues";
  if (bindingRequestId) return fromNotifications(`/admin/population/binding-requests/${bindingRequestId}`);
  if (appointmentId) return fromNotifications(`/admin/appointments/${appointmentId}`);
  if (issueId) return action?.includes("ISSUE_DELETED") ? "/admin/issues" : fromNotifications(`/admin/issues/${issueId}`);

  if (notification.type === "NEWS") {
    if (requestId) return fromNotifications(`/admin/news/requests/${requestId}`);
    if (newsId) return fromNotifications(`/admin/news/${newsId}`);
  }

  if (source?.includes("CALENDAR") || eventId) {
    if (requestId) return fromNotifications(`/admin/calendar/requests/${requestId}`);
    if (eventId) return fromNotifications(`/admin/calendar/${eventId}`);
  }

  if (source?.includes("GALLERY") || albumId) {
    if (gallerySubmissionId) return fromNotifications(`/admin/gallery/submissions/${gallerySubmissionId}`);
    if (albumId) return fromNotifications(`/admin/gallery/${albumId}`);
  }

  if (source?.includes("CONTACT")) {
    if (requestId) return `/admin/contacts/requests/${requestId}`;
    if (contactId) return `/admin/contacts/${contactId}`;
  }

  if (source?.includes("PLACE") || placeId) {
    if (requestId) return `/admin/places/requests/${requestId}`;
    if (placeId) return `/admin/places/${placeId}`;
  }

  // actionUrl is retained for existing structured notifications, but never
  // sends an administrator out of the admin area.
  const actionUrl = stringValue(metadata, "actionUrl");
  return actionUrl?.startsWith("/admin/") ? actionUrl : null;
}

const LEGACY_THAI_COPY: Partial<Record<NotificationType, { title: string; body?: string }>> = {
  BINDING_REQUEST: { title: "มีคำขอผูกเลขบ้านใหม่", body: "มีลูกบ้านส่งคำขอผูกเลขบ้าน กรุณาตรวจสอบรายละเอียดคำขอ" },
  APPOINTMENT_UPDATE: { title: "มีการอัปเดตนัดหมาย" },
  ISSUE_UPDATE: { title: "มีการอัปเดตการแจ้งปัญหา" },
  NEWS: { title: "มีรายการข่าวที่เกี่ยวข้อง" },
};

/** Provides Thai fallbacks for older rows that stored the former English copy. */
export function getAdminNotificationCopy(notification: Pick<Notification, "type" | "title" | "body">) {
  const fallback = LEGACY_THAI_COPY[notification.type];
  const titleIsEnglish = /^[\x00-\x7F]+$/.test(notification.title);
  const bodyIsEnglish = notification.body ? /^[\x00-\x7F]+$/.test(notification.body) : false;

  const isLegacyBinding = notification.type === "BINDING_REQUEST" && (titleIsEnglish || bodyIsEnglish);
  return { title: isLegacyBinding ? fallback!.title : titleIsEnglish && fallback ? fallback.title : notification.title, body: isLegacyBinding ? fallback!.body : bodyIsEnglish && fallback?.body ? fallback.body : notification.body };
}
