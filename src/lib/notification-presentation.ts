import type { Notification, Prisma } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import { Bell, CalendarClock, CalendarDays, CircleAlert, FileDown, FileSearch, Images, MapPin, Megaphone, Newspaper, Phone, UsersRound } from "lucide-react";

type NotificationMetadata = Record<string, Prisma.JsonValue | undefined>;

type NotificationPresentation = { icon: LucideIcon; iconClassName: string; iconContainerClassName: string };

const DEFAULT_PRESENTATION: NotificationPresentation = { icon: Bell, iconClassName: "text-slate-600", iconContainerClassName: "bg-slate-100" };
const PRESENTATIONS = {
  news: { icon: Newspaper, iconClassName: "text-sky-700", iconContainerClassName: "bg-sky-50" },
  issues: { icon: CircleAlert, iconClassName: "text-amber-700", iconContainerClassName: "bg-amber-50" },
  calendar: { icon: CalendarDays, iconClassName: "text-blue-700", iconContainerClassName: "bg-blue-50" },
  appointments: { icon: CalendarClock, iconClassName: "text-violet-700", iconContainerClassName: "bg-violet-50" },
  gallery: { icon: Images, iconClassName: "text-fuchsia-700", iconContainerClassName: "bg-fuchsia-50" },
  contacts: { icon: Phone, iconClassName: "text-cyan-700", iconContainerClassName: "bg-cyan-50" },
  places: { icon: MapPin, iconClassName: "text-emerald-700", iconContainerClassName: "bg-emerald-50" },
  downloads: { icon: FileDown, iconClassName: "text-indigo-700", iconContainerClassName: "bg-indigo-50" },
  transparency: { icon: FileSearch, iconClassName: "text-teal-700", iconContainerClassName: "bg-teal-50" },
  household: { icon: UsersRound, iconClassName: "text-orange-700", iconContainerClassName: "bg-orange-50" },
  broadcast: { icon: Megaphone, iconClassName: "text-rose-700", iconContainerClassName: "bg-rose-50" },
} satisfies Record<string, NotificationPresentation>;

function metadataOf(notification: Pick<Notification, "metadata">): NotificationMetadata {
  return notification.metadata && typeof notification.metadata === "object" && !Array.isArray(notification.metadata) ? notification.metadata as NotificationMetadata : {};
}

function hasString(metadata: NotificationMetadata, key: string) {
  return typeof metadata[key] === "string" && metadata[key].trim().length > 0;
}

/** Maps only structured notification type and metadata fields to its visual module. */
export function resolveNotificationPresentation(notification: Pick<Notification, "type" | "metadata">): NotificationPresentation {
  const metadata = metadataOf(notification);
  const source = typeof metadata.source === "string" ? metadata.source.toUpperCase() : "";
  const actionUrl = typeof metadata.actionUrl === "string" ? metadata.actionUrl : "";
  if (notification.type === "NEWS" || hasString(metadata, "newsId") || source.includes("NEWS")) return PRESENTATIONS.news;
  if (notification.type === "ISSUE_UPDATE" || hasString(metadata, "issueId") || source.includes("ISSUE")) return PRESENTATIONS.issues;
  // Calendar and appointments are separate Resident modules. Prioritize the
  // explicit source semantics, then their durable target identifiers, never
  // card copy. This also handles malformed legacy metadata containing both IDs.
  if (source.includes("APPOINTMENT")) return PRESENTATIONS.appointments;
  if (source.includes("CALENDAR")) return PRESENTATIONS.calendar;
  if (notification.type === "APPOINTMENT_UPDATE" || hasString(metadata, "appointmentId")) return PRESENTATIONS.appointments;
  if (hasString(metadata, "eventId") || actionUrl.includes("/calendar")) return PRESENTATIONS.calendar;
  if (hasString(metadata, "albumId") || hasString(metadata, "batchId") || source.includes("GALLERY")) return PRESENTATIONS.gallery;
  if (hasString(metadata, "contactId") || hasString(metadata, "approvedContactId") || hasString(metadata, "targetContactId") || source.includes("CONTACT")) return PRESENTATIONS.contacts;
  if (hasString(metadata, "placeId") || source.includes("PLACE") || actionUrl.includes("/places")) return PRESENTATIONS.places;
  if (hasString(metadata, "fileId") || source.includes("DOWNLOAD") || actionUrl.includes("/downloads")) return PRESENTATIONS.downloads;
  if (hasString(metadata, "transparencyId") || source.includes("TRANSPARENCY") || actionUrl.includes("/transparency")) return PRESENTATIONS.transparency;
  if (notification.type === "BINDING_REQUEST" || notification.type === "CORRECTION_REQUEST" || hasString(metadata, "bindingRequestId") || hasString(metadata, "correctionRequestId") || actionUrl.includes("/binding") || actionUrl.includes("/household")) return PRESENTATIONS.household;
  if (source === "SUPERADMIN_BROADCAST" || notification.type === "EMERGENCY" || notification.type === "SOS") return PRESENTATIONS.broadcast;
  if (notification.type === "SYSTEM" && hasString(metadata, "personId")) return PRESENTATIONS.household;
  return DEFAULT_PRESENTATION;
}

export type NotificationDateGroup = "today" | "yesterday" | "older";
function bangkokDayKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}
export function notificationDateGroup(value: Date, now = new Date()): NotificationDateGroup {
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return bangkokDayKey(value) === bangkokDayKey(now) ? "today" : bangkokDayKey(value) === bangkokDayKey(yesterday) ? "yesterday" : "older";
}
export function groupNotificationsByDate<T extends { createdAt: Date }>(notifications: T[], now = new Date()) {
  const groups: Record<NotificationDateGroup, T[]> = { today: [], yesterday: [], older: [] };
  for (const notification of notifications) groups[notificationDateGroup(notification.createdAt, now)].push(notification);
  return groups;
}
export function formatNotificationTimestamp(value: Date) {
  const group = notificationDateGroup(value);
  const time = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(value);
  if (group === "today") return `วันนี้ ${time}`;
  if (group === "yesterday") return `เมื่อวาน ${time}`;
  return `${new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" }).format(value)} เวลา ${time}`;
}
