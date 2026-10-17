import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  calendarEventCreatorId,
  canHeadmanEditCalendarEvent,
  getCalendarEventDeletionPolicy,
  residentEventDeletionNotification,
} from "../src/lib/calendar-event-policy.ts";
import { ActionReasonError, requireActionReason } from "../src/lib/sensitive-action-policy.ts";

const headmanId = "headman-user";
const residentId = "resident-house-user";

assert.equal(calendarEventCreatorId({ kind: "RESIDENT_REQUEST", requesterId: residentId }), residentId);
assert.equal(calendarEventCreatorId({ kind: "HEADMAN", actorUserId: headmanId }), headmanId);
assert.equal(canHeadmanEditCalendarEvent(headmanId, headmanId), true);
assert.equal(canHeadmanEditCalendarEvent(residentId, headmanId), false);

assert.throws(() => requireActionReason("content.delete", "no"), ActionReasonError);
const reason = requireActionReason("content.delete", "  ข้อมูลกิจกรรมไม่ถูกต้อง  ");
assert.equal(reason, "ข้อมูลกิจกรรมไม่ถูกต้อง");

const residentDeletion = getCalendarEventDeletionPolicy(residentId, headmanId);
assert.deepEqual(residentDeletion, { eventOrigin: "RESIDENT", notificationUserId: residentId });
assert.deepEqual(getCalendarEventDeletionPolicy(headmanId, headmanId), { eventOrigin: "HEADMAN", notificationUserId: null });
assert.deepEqual(residentEventDeletionNotification("ประชุมหมู่บ้าน", reason), {
  title: "กิจกรรมของคุณถูกลบออกจากปฏิทิน",
  body: `“ประชุมหมู่บ้าน” ถูกลบออกจากปฏิทิน\nเหตุผล: ${reason}`,
  actionUrl: "/resident/calendar/requests?tab=history",
  actionLabel: "ดูประวัติคำขอ",
});

const actionSource = await readFile(new URL("../src/app/(admin)/admin/calendar/actions.ts", import.meta.url), "utf8");
assert.match(actionSource, /await tx\.villageEvent\.delete\(\{ where: \{ id \} \}\)/);
assert.match(actionSource, /userId: deletionPolicy\.notificationUserId/);
assert.match(actionSource, /createdById: calendarEventCreatorId\(\{ kind: "RESIDENT_REQUEST", requesterId: request\.requesterId \}\)/);

console.log("Calendar creator attribution, edit policy, and resident deletion policy checks passed.");
