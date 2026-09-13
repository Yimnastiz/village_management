import test from "node:test";
import assert from "node:assert/strict";
import {
  configuredHeadmanLoginAuditWhere,
  configuredVillageLoginAuditWhere,
  isConfiguredActiveHeadmanMembership,
  isConfiguredActiveVillageActorMembership,
} from "../src/lib/login-audit-policy.js";

test("Headman login audits are scoped to the configured Village", () => {
  assert.deepEqual(configuredHeadmanLoginAuditWhere("user-1", "village-a"), {
    userId: "user-1",
    villageId: "village-a",
    status: "ACTIVE",
    role: "HEADMAN",
  });
});

test("successful login audits include only active Resident and Headman memberships", () => {
  assert.deepEqual(configuredVillageLoginAuditWhere("user-1", "village-a"), {
    userId: "user-1",
    villageId: "village-a",
    status: "ACTIVE",
    role: { in: ["HEADMAN", "RESIDENT"] },
  });
  assert.equal(isConfiguredActiveVillageActorMembership({ villageId: "village-a", status: "ACTIVE", role: "RESIDENT" }, "village-a"), true);
  assert.equal(isConfiguredActiveVillageActorMembership({ villageId: "village-a", status: "ACTIVE", role: "ASSISTANT_HEADMAN" }, "village-a"), false);
  assert.equal(isConfiguredActiveVillageActorMembership({ villageId: "village-a", status: "ACTIVE", role: "SUPERADMIN" }, "village-a"), false);
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
