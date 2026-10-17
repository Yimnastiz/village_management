export type CalendarEventOrigin = "HEADMAN" | "RESIDENT";

export function calendarEventCreatorId(input: { kind: "HEADMAN"; actorUserId: string } | { kind: "RESIDENT_REQUEST"; requesterId: string }) {
  return input.kind === "HEADMAN" ? input.actorUserId : input.requesterId;
}

export function canHeadmanEditCalendarEvent(createdById: string | null, currentHeadmanUserId: string) {
  return createdById === currentHeadmanUserId;
}

export function getCalendarEventDeletionPolicy(createdById: string | null, currentHeadmanUserId: string): {
  eventOrigin: CalendarEventOrigin;
  notificationUserId: string | null;
} {
  const residentOwned = Boolean(createdById && createdById !== currentHeadmanUserId);
  return {
    eventOrigin: residentOwned ? "RESIDENT" : "HEADMAN",
    notificationUserId: residentOwned ? createdById : null,
  };
}

export function residentEventDeletionNotification(eventTitle: string, reason: string) {
  return {
    title: "กิจกรรมของคุณถูกลบออกจากปฏิทิน",
    body: `“${eventTitle}” ถูกลบออกจากปฏิทิน\nเหตุผล: ${reason}`,
    actionUrl: "/resident/calendar/requests?tab=history",
    actionLabel: "ดูประวัติคำขอ",
  } as const;
}
