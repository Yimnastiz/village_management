import test from "node:test";
import assert from "node:assert/strict";
import { BindingRequestStatus, MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { ACCESS_MEMBERSHIP_ROLES, belongsInAccessManagement, isRequestPlaceholderStatus } from "../src/lib/settings-access.ts";
import { hasVillagePermission } from "../src/lib/village-permissions.ts";

test("pending binding applicant is not an access target", () => {
  assert.equal(belongsInAccessManagement(MembershipStatus.PENDING), false);
});

test("rejected binding applicant stays request history but is not an access target", () => {
  const request = { status: BindingRequestStatus.REJECTED, reviewNote: "ข้อมูลบ้านไม่ตรง" };
  assert.equal(request.status, BindingRequestStatus.REJECTED);
  assert.ok(request.reviewNote);
  assert.equal(belongsInAccessManagement(MembershipStatus.REJECTED), false);
});

test("approved active member is an access target", () => {
  assert.equal(belongsInAccessManagement(MembershipStatus.ACTIVE), true);
});

test("suspended existing member remains an access target", () => {
  assert.equal(belongsInAccessManagement(MembershipStatus.SUSPENDED), true);
});

test("rejected request cannot overwrite an existing active or suspended membership", () => {
  assert.equal(isRequestPlaceholderStatus(MembershipStatus.ACTIVE), false);
  assert.equal(isRequestPlaceholderStatus(MembershipStatus.SUSPENDED), false);
  assert.equal(isRequestPlaceholderStatus(MembershipStatus.PENDING), true);
});

test("active access filters contain only final membership roles", () => {
  assert.deepEqual(new Set(ACCESS_MEMBERSHIP_ROLES), new Set([VillageMembershipRole.HEADMAN, VillageMembershipRole.RESIDENT]));
});

test("only HEADMAN has system-settings authority", () => {
  assert.equal(hasVillagePermission(VillageMembershipRole.HEADMAN, "village.settings.manage"), true);
  assert.equal(hasVillagePermission("ASSISTANT_HEADMAN", "village.settings.manage"), false);
  assert.equal(hasVillagePermission(VillageMembershipRole.RESIDENT, "village.settings.manage"), false);
});
