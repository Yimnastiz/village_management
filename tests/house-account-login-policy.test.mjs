import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { houseLoginEligibility } from "../src/lib/house-account-login-policy.ts";

const eligible = {
  accountEmailStatus: "ACTIVE",
  accountEmailVerifiedAt: new Date("2026-09-23T12:00:00.000Z"),
  accountEmailActivatedAt: new Date("2026-09-23T11:00:00.000Z"),
  accountEmailRevokedAt: null,
  accountEmailUserId: "user-house-168",
  accountEmailHouseAccountId: "house-account-168",
  houseAccountId: "house-account-168",
  houseAccountUserId: "user-house-168",
  houseAccountVillageId: "village-1",
  houseAccountHouseId: "house-168",
  houseAccountActivatedAt: new Date("2026-09-23T11:00:00.000Z"),
  houseAccountSuspendedAt: null,
  houseVillageId: "village-1",
  configuredVillageId: "village-1",
  enteredHouseId: "house-168",
  userAccountKind: "RESIDENT_HOUSE",
  userAccountStatus: "ACTIVE",
  membershipRole: "RESIDENT",
  membershipStatus: "ACTIVE",
  membershipVillageId: "village-1",
  membershipHouseId: "house-168",
};

test("multiple active aliases can independently resolve to the same House Account User", () => {
  const momAlias = { ...eligible, accountEmailUserId: "user-house-168" };
  const dadAlias = { ...eligible, accountEmailUserId: "user-house-168" };
  assert.equal(houseLoginEligibility(momAlias), "ELIGIBLE");
  assert.equal(houseLoginEligibility(dadAlias), "ELIGIBLE");
  assert.equal(momAlias.accountEmailUserId, dadAlias.accountEmailUserId);
});

test("wrong-House alias use fails closed", () => {
  assert.equal(
    houseLoginEligibility({ ...eligible, enteredHouseId: "house-170" }),
    "WRONG_HOUSE",
  );
});

test("revoked alias and suspended House Account cannot authenticate", () => {
  assert.equal(
    houseLoginEligibility({ ...eligible, accountEmailStatus: "REVOKED" }),
    "EMAIL_INACTIVE",
  );
  assert.equal(
    houseLoginEligibility({ ...eligible, accountEmailRevokedAt: new Date() }),
    "EMAIL_INACTIVE",
  );
  assert.equal(
    houseLoginEligibility({ ...eligible, houseAccountSuspendedAt: new Date() }),
    "ACCOUNT_SUSPENDED",
  );
  assert.equal(
    houseLoginEligibility({ ...eligible, membershipStatus: "SUSPENDED" }),
    "MEMBERSHIP_INACTIVE",
  );
});

test("legacy resident, Headman, cross-village, and mismatched relations are rejected", () => {
  assert.equal(houseLoginEligibility({ ...eligible, userAccountKind: "LEGACY_RESIDENT" }), "ACCOUNT_INACTIVE");
  assert.equal(houseLoginEligibility({ ...eligible, userAccountKind: "HEADMAN" }), "ACCOUNT_INACTIVE");
  assert.equal(houseLoginEligibility({ ...eligible, houseVillageId: "village-2" }), "WRONG_VILLAGE");
  assert.equal(houseLoginEligibility({ ...eligible, accountEmailHouseAccountId: "other" }), "IDENTITY_MISMATCH");
});

test("House login resolves AccountEmail and never creates or queries a User by login email", () => {
  const source = readFileSync(new URL("../src/lib/house-account-login-service.ts", import.meta.url), "utf8");
  assert.match(source, /accountEmail\.findUnique/u);
  assert.match(source, /purpose:\s*"HOUSE_LOGIN"/u);
  assert.doesNotMatch(source, /user\.create\s*\(/u);
  assert.doesNotMatch(source, /user\.find(?:First|Unique)\s*\([\s\S]{0,160}email/u);
});

test("public start keeps ineligible credentials as a decoy flow and sends no OTP", () => {
  const source = readFileSync(new URL("../src/lib/house-account-login-service.ts", import.meta.url), "utf8");
  assert.match(source, /if \(!identity\) return flowFromRow\(flow\)/u);
  assert.match(source, /issueEmailOtpChallenge\s*\(\{/u);
  assert.match(source, /const identity = syntacticallyValid/u);
});
