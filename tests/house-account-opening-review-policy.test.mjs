import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildHouseAccountActivationData,
  normalizeOpeningRejectionReason,
  openingReviewEligibility,
} from "../src/lib/house-account-opening-review-policy.ts";

const eligible = {
  requestStatus: "PENDING_REVIEW",
  requestVillageId: "village-1",
  houseVillageId: "village-1",
  configuredVillageId: "village-1",
  accountEmailStatus: "VERIFIED_PENDING_REVIEW",
  accountEmailVerifiedAt: new Date("2026-09-23T10:00:00.000Z"),
  hasResidentHouseAccount: false,
  activatedUserId: null,
};

test("only a pending-review request with verified email is eligible", () => {
  assert.equal(openingReviewEligibility(eligible), "ELIGIBLE");
  assert.equal(openingReviewEligibility({ ...eligible, requestStatus: "PENDING_EMAIL_VERIFICATION" }), "REQUEST_NOT_REVIEWABLE");
  assert.equal(openingReviewEligibility({ ...eligible, accountEmailStatus: "PENDING_VERIFICATION" }), "EMAIL_NOT_VERIFIED");
  assert.equal(openingReviewEligibility({ ...eligible, accountEmailVerifiedAt: null }), "EMAIL_NOT_VERIFIED");
});

test("stale, cross-village, active-House, and duplicate approvals are blocked", () => {
  assert.equal(openingReviewEligibility({ ...eligible, requestVillageId: "village-2" }), "WRONG_VILLAGE");
  assert.equal(openingReviewEligibility({ ...eligible, houseVillageId: "village-2" }), "WRONG_VILLAGE");
  assert.equal(openingReviewEligibility({ ...eligible, hasResidentHouseAccount: true }), "HOUSE_ALREADY_ACTIVE");
  assert.equal(openingReviewEligibility({ ...eligible, activatedUserId: "user-1" }), "ALREADY_ACTIVATED");
  assert.equal(openingReviewEligibility({ ...eligible, requestStatus: "APPROVED" }), "ALREADY_APPROVED");
  assert.equal(openingReviewEligibility({ ...eligible, requestStatus: "REJECTED" }), "ALREADY_REJECTED");
});

test("rejection requires a non-empty bounded reason", () => {
  assert.equal(normalizeOpeningRejectionReason("  ข้อมูลไม่ครบ  "), "ข้อมูลไม่ครบ");
  assert.equal(normalizeOpeningRejectionReason("   "), null);
  assert.equal(normalizeOpeningRejectionReason(null), null);
  assert.equal(normalizeOpeningRejectionReason("x".repeat(2001)), null);
});

test("activation plan creates a House-semantic account without a phone credential", () => {
  const activatedAt = new Date("2026-09-23T10:30:00.000Z");
  const plan = buildHouseAccountActivationData({
    villageId: "village-1",
    houseId: "house-1",
    houseNumber: "168/4",
    contactPhone: "0812345678",
    verifiedEmail: "home@example.com",
    activatedAt,
  });
  assert.deepEqual(plan.user, {
    name: "บ้านเลขที่ 168/4",
    email: "home@example.com",
    emailVerified: true,
    phoneNumber: null,
    phoneNumberVerified: false,
    accountKind: "RESIDENT_HOUSE",
  });
  assert.deepEqual(plan.residentHouseAccount, {
    villageId: "village-1",
    houseId: "house-1",
    contactPhone: "0812345678",
    activatedAt,
  });
  assert.deepEqual(plan.membership, {
    villageId: "village-1",
    houseId: "house-1",
    role: "RESIDENT",
    status: "ACTIVE",
    joinedAt: activatedAt,
  });
});

test("activation service keeps population Person records independent", () => {
  const source = readFileSync(new URL("../src/lib/house-account-opening-review-service.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\.person\.create\s*\(/u);
  assert.match(source, /residentHouseAccount\.create\s*\(/u);
  assert.match(source, /villageMembership\.create\s*\(/u);
  assert.match(source, /user\.create\s*\(/u);
});

test("rejection releases email without creating an account and approval is one transaction", () => {
  const source = readFileSync(new URL("../src/lib/house-account-opening-review-service.ts", import.meta.url), "utf8");
  const rejection = source.slice(
    source.indexOf("export async function rejectHouseAccountOpeningRequest"),
    source.indexOf("export async function approveAndActivateHouseAccount"),
  );
  assert.match(rejection, /status:\s*HouseAccountOpeningRequestStatus\.REJECTED/u);
  assert.match(rejection, /releaseOpeningRequestEmailInTransaction\(tx/u);
  assert.doesNotMatch(rejection, /(?:user|residentHouseAccount|villageMembership)\.create\s*\(/u);

  const approval = source.slice(source.indexOf("export async function approveAndActivateHouseAccount"));
  assert.match(approval, /prisma\.\$transaction\s*\(/u);
  assert.match(approval, /accountKind:\s*"RESIDENT_HOUSE"|buildHouseAccountActivationData/u);
  assert.match(approval, /activateAccountEmailInTransaction\(tx/u);
  assert.match(approval, /status:\s*HouseAccountOpeningRequestStatus\.APPROVED/u);
});
