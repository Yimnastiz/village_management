import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { hasVillagePermission, requireVillagePermission, VillagePermissionError } from "../src/lib/village-permissions.ts";
import { getActionPolicy, requireActionReason, ActionReasonError } from "../src/lib/sensitive-action-policy.ts";

const HEADMAN = "HEADMAN";

test("Headman owns all administration permissions", () => {
  for (const permission of [
    "dashboard.view", "news.manage", "news.requests.review", "gallery.manage", "gallery.requests.review",
    "places.manage", "places.requests.review", "contacts.manage", "contacts.requests.review", "downloads.manage",
    "transparency.manage", "calendar.manage", "calendar.requests.review", "issues.manage", "appointments.manage",
    "population.view", "population.person.manage", "population.house.manage", "population.import",
    "population.import.rollback", "population.export_sensitive", "members.view", "members.status.manage",
    "members.roles.manage", "village.settings.manage", "audit.view", "feedback.manage", "broadcasts.manage",
  ]) assert.equal(hasVillagePermission(HEADMAN, permission), true);
});

test("server permission guard rejects non-Headman roles", () => {
  assert.throws(() => requireVillagePermission({ role: "RESIDENT" }, "population.import"), VillagePermissionError);
});

test("sensitive operations require a meaningful reason", () => {
  for (const action of ["member.suspend", "member.reactivate", "population.import", "population.import.rollback", "population.export_sensitive", "content.delete", "content.archive", "appointment.cancel", "issue.close"]) {
    const policy = getActionPolicy(action);
    assert.equal(policy.requiresReason, true);
    assert.equal(policy.minReasonLength, 5);
    assert.throws(() => requireActionReason(action, "    "), ActionReasonError);
    assert.equal(requireActionReason(action, "  valid reason  "), "valid reason");
  }
});

test("shared ActionReasonDialog carries the sensitive-form contract", async () => {
  const source = await readFile(new URL("../src/components/admin/action-reason-dialog.tsx", import.meta.url), "utf8");
  assert.match(source, /closeOnBackdrop=\{false\}/);
  assert.match(source, /label=\{reasonLabel\} required/);
  assert.match(source, /disabled=\{!valid \|\| busy\}/);
});
