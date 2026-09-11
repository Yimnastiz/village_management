import test from "node:test";
import assert from "node:assert/strict";
import {
  configuredHeadmanLoginAuditWhere,
  isConfiguredActiveHeadmanMembership,
} from "../src/lib/login-audit-policy.js";

test("Headman login audits are scoped to the configured Village", () => {
  assert.deepEqual(configuredHeadmanLoginAuditWhere("user-1", "village-a"), {
    userId: "user-1",
    villageId: "village-a",
    status: "ACTIVE",
    role: "HEADMAN",
  });
});

test("configured Village A is the only eligible Headman login audit membership", () => {
  const memberships = [
    { userId: "user-1", villageId: "village-b", status: "ACTIVE", role: "HEADMAN" },
    { userId: "user-1", villageId: "village-a", status: "ACTIVE", role: "HEADMAN" },
  ];

  assert.deepEqual(
    memberships.filter((membership) => isConfiguredActiveHeadmanMembership(membership, "village-a")),
    [memberships[1]]
  );
});
