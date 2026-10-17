import { toDateKey } from "./calendar-month.ts";

export type CalendarEventLike = {
  startsAt: string | Date;
  endsAt: string | Date | null;
};

export type CalendarEventOccurrence<T extends CalendarEventLike> = {
  event: T;
  dateKey: string;
  startsToday: boolean;
  continuesFromPreviousDay: boolean;
};

/**
 * Returns every Thai-local calendar date touched by an event using [start, end)
 * semantics. An end at exactly midnight therefore does not occupy the new day.
 */
export function getCalendarEventDateKeys(event: CalendarEventLike): string[] {
  const startsAt = new Date(event.startsAt);
  const endsAt = event.endsAt ? new Date(event.endsAt) : null;
  const startKey = toDateKey(startsAt);

  if (!endsAt || endsAt.getTime() <= startsAt.getTime()) return [startKey];

  const lastActiveKey = toDateKey(new Date(endsAt.getTime() - 1));
  const cursor = new Date(`${startKey}T00:00:00+07:00`);
  const lastActiveDate = new Date(`${lastActiveKey}T00:00:00+07:00`);
  const dateKeys: string[] = [];

  while (cursor <= lastActiveDate) {
    dateKeys.push(toDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dateKeys;
}

export function expandCalendarEventOccurrences<T extends CalendarEventLike>(events: T[]) {
  const occurrences = new Map<string, CalendarEventOccurrence<T>[]>();

  for (const event of events) {
    const startKey = toDateKey(new Date(event.startsAt));
    for (const dateKey of getCalendarEventDateKeys(event)) {
      const startsToday = dateKey === startKey;
      const occurrence = {
        event,
        dateKey,
        startsToday,
        continuesFromPreviousDay: !startsToday,
      };
      occurrences.set(dateKey, [...(occurrences.get(dateKey) ?? []), occurrence]);
    }
  }

  for (const dayOccurrences of occurrences.values()) {
    dayOccurrences.sort((a, b) => {
      if (a.startsToday !== b.startsToday) return a.startsToday ? -1 : 1;
      return new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime();
    });
  }

  return occurrences;
}
