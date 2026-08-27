import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  canManageVillageRole,
  hasVillagePermission,
  requireVillagePermission,
  VillagePermissionError,
} from "../src/lib/village-permissions.ts";
import { getActionPolicy, requireActionReason, ActionReasonError } from "../src/lib/sensitive-action-policy.ts";

const HEADMAN = "HEADMAN";
const ASSISTANT = "ASSISTANT_HEADMAN";

test("governance permissions belong only to HEADMAN", () => {
  for (const permission of ["population.import", "population.import.rollback", "population.export_sensitive", "members.roles.manage", "village.settings.manage"]) {
    assert.equal(hasVillagePermission(HEADMAN, permission), true);
    assert.equal(hasVillagePermission(ASSISTANT, permission), false);
  }
});

test("both village admin roles receive operational permissions", () => {
  for (const permission of [
    "dashboard.view", "news.manage", "news.requests.review", "gallery.manage", "gallery.requests.review",
    "places.manage", "places.requests.review", "contacts.manage", "contacts.requests.review", "downloads.manage",
    "transparency.manage", "calendar.manage", "calendar.requests.review", "issues.manage", "appointments.manage",
    "population.view", "population.person.manage", "population.house.manage",
    "binding.review", "members.view", "members.status.manage", "audit.view",
  ]) {
    assert.equal(hasVillagePermission(HEADMAN, permission), true);
    assert.equal(hasVillagePermission(ASSISTANT, permission), true);
  }
});

test("neither village role can manage HEADMAN accounts", () => {
  assert.equal(canManageVillageRole(HEADMAN, "HEADMAN", "RESIDENT"), false);
  assert.equal(canManageVillageRole(HEADMAN, "RESIDENT", "HEADMAN"), false);
  assert.equal(canManageVillageRole(ASSISTANT, "RESIDENT", "ASSISTANT_HEADMAN"), false);
  assert.equal(canManageVillageRole(HEADMAN, "RESIDENT", "ASSISTANT_HEADMAN"), true);
});

test("server permission guard denies a bypassed Assistant import", () => {
  assert.throws(() => requireVillagePermission({ role: ASSISTANT }, "population.import"), VillagePermissionError);
});

test("binding approval policy distinguishes routine and override decisions", () => {
  assert.equal(getActionPolicy("binding.approve").requiresReason, false);
  assert.deepEqual(getActionPolicy("binding.reject"), { requiresReason: true, minReasonLength: 5, audit: true, notifyAffectedUser: true });
  assert.equal(getActionPolicy("binding.override_mismatch").requiresReason, true);
});

test("member suspension, import, rollback, and sensitive export require five characters", () => {
  for (const action of ["member.suspend", "member.reactivate", "member.role.assign", "member.role.remove", "population.import", "population.import.rollback", "population.export_sensitive", "content.delete", "content.archive", "appointment.cancel", "issue.close"]) {
    const policy = getActionPolicy(action);
    assert.equal(policy.requiresReason, true);
    assert.equal(policy.minReasonLength, 5);
    assert.throws(() => requireActionReason(action, "    "), ActionReasonError);
    assert.throws(() => requireActionReason(action, "1234"), ActionReasonError);
    assert.equal(requireActionReason(action, "  valid reason  "), "valid reason");
  }
});

test("shared ActionReasonDialog carries the consistent sensitive-form contract", async () => {
  const source = await readFile(new URL("../src/components/admin/action-reason-dialog.tsx", import.meta.url), "utf8");
  assert.match(source, /closeOnBackdrop=\{false\}/);
  assert.match(source, /reasonLabel = "เหตุผล"/);
  assert.match(source, /label=\{reasonLabel\} required/);
  assert.match(source, /อย่างน้อย/);
  assert.match(source, /disabled=\{!valid \|\| busy\}/);
});
