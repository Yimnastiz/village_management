import test from "node:test";
import assert from "node:assert/strict";
import {
  APPOINTMENT_STAGE_VALUES,
  ISSUE_CATEGORY_VALUES,
  ISSUE_PRIORITY_VALUES,
  ISSUE_STAGE_VALUES,
  appointmentStageSchema,
  appointmentTimeSchema,
  appointmentTitleSchema,
  issueCategorySchema,
  issueDescriptionSchema,
  issuePrioritySchema,
  issueStageSchema,
  issueTitleSchema,
  parseAppointmentDate,
  rejectionNoteSchema,
  suggestedTimeMessageSchema,
} from "../src/lib/issue-appointment-validation.ts";

test("issue required text is trimmed before minimum validation", () => {
  assert.equal(issueTitleSchema.parse("  ถนนชำรุด  "), "ถนนชำรุด");
  assert.equal(issueTitleSchema.safeParse("     ").success, false);
  assert.equal(issueDescriptionSchema.parse("  ถนนมีหลุมขนาดใหญ่  "), "ถนนมีหลุมขนาดใหญ่");
  assert.equal(issueDescriptionSchema.safeParse("          ").success, false);
});

test("all actual issue enums are accepted and arbitrary strings are rejected", () => {
  for (const value of ISSUE_CATEGORY_VALUES) assert.equal(issueCategorySchema.safeParse(value).success, true);
  for (const value of ISSUE_PRIORITY_VALUES) assert.equal(issuePrioritySchema.safeParse(value).success, true);
  for (const value of ISSUE_STAGE_VALUES) assert.equal(issueStageSchema.safeParse(value).success, true);
  assert.equal(issueCategorySchema.safeParse("ROAD_X").success, false);
  assert.equal(issuePrioritySchema.safeParse("NORMAL").success, false);
  assert.equal(issueStageSchema.safeParse("PENDING").success, false);
});

test("appointment titles trim before minimum validation", () => {
  assert.equal(appointmentTitleSchema.parse("  นัดพบ  "), "นัดพบ");
  assert.equal(appointmentTitleSchema.safeParse("   ").success, false);
});

test("appointment date parsing rejects rollover, malformed, and past dates without timezone shifts", () => {
  const today = new Date(2026, 9, 11, 12, 0, 0);
  const sameDay = parseAppointmentDate("2026-10-11", today);
  assert.equal(sameDay.ok, true);
  if (sameDay.ok) assert.equal(sameDay.date.toISOString(), "2026-10-11T00:00:00.000Z");
  assert.equal(parseAppointmentDate("2026-12-31", today).ok, true);
  assert.equal(parseAppointmentDate("2026-02-30", today).ok, false);
  assert.equal(parseAppointmentDate("2026-13-01", today).ok, false);
  assert.equal(parseAppointmentDate("2026-00-10", today).ok, false);
  assert.equal(parseAppointmentDate("11-10-2026", today).ok, false);
  assert.equal(parseAppointmentDate("2026-10-10", today).ok, false);
});

test("appointment time, rejection reason, and suggested message use exact limits", () => {
  assert.equal(appointmentTimeSchema.safeParse("09:30").success, true);
  assert.equal(appointmentTimeSchema.safeParse("24:00").success, false);
  assert.equal(appointmentTimeSchema.safeParse("10:99").success, false);
  assert.equal(rejectionNoteSchema.safeParse(" no ").success, false);
  assert.equal(rejectionNoteSchema.safeParse("     ").success, false);
  assert.equal(rejectionNoteSchema.parse("  เหตุผลเพียงพอ  "), "เหตุผลเพียงพอ");
  assert.equal(suggestedTimeMessageSchema.safeParse("a".repeat(500)).success, true);
  assert.equal(suggestedTimeMessageSchema.safeParse("a".repeat(501)).success, false);
});

test("appointment stage allowlist matches the persisted state machine", () => {
  for (const value of APPOINTMENT_STAGE_VALUES) assert.equal(appointmentStageSchema.safeParse(value).success, true);
  assert.equal(appointmentStageSchema.safeParse("OPEN").success, false);
});
