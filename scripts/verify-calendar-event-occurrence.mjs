import assert from "node:assert/strict";
import {
  expandCalendarEventOccurrences,
  getCalendarEventDateKeys,
} from "../src/lib/calendar-event-occurrence.ts";

const atBangkokTime = (value) => new Date(`${value}+07:00`);

assert.deepEqual(
  getCalendarEventDateKeys({ startsAt: atBangkokTime("2026-10-18T12:00:00"), endsAt: atBangkokTime("2026-10-18T18:00:00") }),
  ["2026-10-18"],
);
assert.deepEqual(
  getCalendarEventDateKeys({ startsAt: atBangkokTime("2026-10-18T12:00:00"), endsAt: atBangkokTime("2026-10-19T08:00:00") }),
  ["2026-10-18", "2026-10-19"],
);
assert.deepEqual(
  getCalendarEventDateKeys({ startsAt: atBangkokTime("2026-10-18T12:00:00"), endsAt: atBangkokTime("2026-10-19T00:00:00") }),
  ["2026-10-18"],
);
assert.deepEqual(
  getCalendarEventDateKeys({ startsAt: atBangkokTime("2026-10-18T00:00:00"), endsAt: atBangkokTime("2026-10-20T00:00:00") }),
  ["2026-10-18", "2026-10-19"],
);

const eventA = { id: "a", startsAt: atBangkokTime("2026-10-18T12:00:00"), endsAt: atBangkokTime("2026-10-19T08:00:00") };
const eventB = { id: "b", startsAt: atBangkokTime("2026-10-19T10:00:00"), endsAt: atBangkokTime("2026-10-19T12:00:00") };
const october19 = expandCalendarEventOccurrences([eventA, eventB]).get("2026-10-19");

assert.deepEqual(october19?.map(({ event }) => event.id), ["b", "a"]);
assert.equal(october19?.[0]?.startsToday, true);
assert.equal(october19?.[1]?.continuesFromPreviousDay, true);

console.log("Calendar event occurrence checks passed.");
