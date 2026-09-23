import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { isHeadmanPhoneLoginEligible, isResidentHouseAccessEligible } from "../src/lib/final-account-access-policy.ts";

const root = new URL("../", import.meta.url);
const source = (path) => readFileSync(new URL(path, root), "utf8");

const activeHouseAccount = {
  villageId: "village-1",
  houseId: "house-1",
  activatedAt: new Date("2026-09-23T00:00:00.000Z"),
  suspendedAt: null,
};
const activeMembership = { villageId: "village-1", houseId: "house-1", role: "RESIDENT", status: "ACTIVE" };

test("only a valid active Resident House Account receives Resident access", () => {
  const valid = { accountKind: "RESIDENT_HOUSE", configuredVillageId: "village-1", houseAccount: activeHouseAccount, membership: activeMembership };
  assert.equal(isResidentHouseAccessEligible(valid), true);
  assert.equal(isResidentHouseAccessEligible({ ...valid, accountKind: "LEGACY_RESIDENT" }), false);
  assert.equal(isResidentHouseAccessEligible({ ...valid, accountKind: "HEADMAN" }), false);
  assert.equal(isResidentHouseAccessEligible({ ...valid, houseAccount: null }), false);
  assert.equal(isResidentHouseAccessEligible({ ...valid, houseAccount: { ...activeHouseAccount, suspendedAt: new Date() } }), false);
  assert.equal(isResidentHouseAccessEligible({ ...valid, membership: { ...activeMembership, houseId: "house-2" } }), false);
  assert.equal(isResidentHouseAccessEligible({ ...valid, configuredVillageId: "village-2" }), false);
});

test("citizen verification is not part of Resident House access", () => {
  const input = { accountKind: "RESIDENT_HOUSE", configuredVillageId: "village-1", houseAccount: activeHouseAccount, membership: activeMembership };
  assert.equal(isResidentHouseAccessEligible(input), true);
  assert.equal("citizenVerifiedAt" in input, false);
});

test("phone OTP eligibility is Headman-only with transition support for null kind", () => {
  const active = { accountStatus: "ACTIVE", hasActiveConfiguredHeadmanMembership: true };
  assert.equal(isHeadmanPhoneLoginEligible({ ...active, accountKind: "HEADMAN" }), true);
  assert.equal(isHeadmanPhoneLoginEligible({ ...active, accountKind: null }), true);
  assert.equal(isHeadmanPhoneLoginEligible({ ...active, accountKind: "RESIDENT_HOUSE" }), false);
  assert.equal(isHeadmanPhoneLoginEligible({ ...active, accountKind: "LEGACY_RESIDENT" }), false);
  assert.equal(isHeadmanPhoneLoginEligible({ ...active, accountKind: "HEADMAN", hasActiveConfiguredHeadmanMembership: false }), false);
});

test("personal registration and Binding mutation handlers no longer exist", () => {
  const retired = [
    "src/app/api/auth/check-phone/route.ts",
    "src/app/api/auth/start-registration/route.ts",
    "src/app/api/auth/resume-registration/route.ts",
    "src/app/api/auth/resend-registration-otp/route.ts",
    "src/app/api/auth/cancel-registration/route.ts",
    "src/app/api/auth/verify-registration-otp/route.ts",
    "src/app/(auth)/auth/binding/actions.ts",
    "src/app/(resident)/resident/binding/actions.ts",
  ];
  for (const path of retired) assert.equal(existsSync(new URL(path, root)), false, path);
});

test("population import cannot create or attach Resident auth identities", () => {
  const actions = source("src/app/(admin)/admin/population/import/actions.ts");
  const template = source("src/features/population/server/import-template.ts");
  assert.doesNotMatch(actions, /createUserAccount|registrationTemp|phoneRoleSeed|tx\.user\.(?:create|update)|userId:\s*resolvedUserId/);
  assert.doesNotMatch(template, /create_user_account|is_citizen_verified/);
  assert.match(actions, /nationalId:\s*row\.nationalId/);
  assert.match(actions, /tx\.person\.(?:create|update)/);
});

test("final routing has no duplicate-account or Binding destination", () => {
  const access = source("src/lib/access-control.ts");
  const proxy = source("src/proxy.ts");
  assert.match(access, /\/auth\/account-migration-required/);
  assert.doesNotMatch(access, /\/auth\/account-duplicate|\/resident\/binding/);
  assert.doesNotMatch(proxy, /\/auth\/account-duplicate|\/resident\/binding|DUPLICATE_NOTICE/);
});
