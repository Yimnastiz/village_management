import test from "node:test";
import assert from "node:assert/strict";
import {
  canReclaimAccountEmail,
  canReleaseOpeningRequestEmail,
  canTransitionAccountEmail,
  decideAccountEmailReservation,
  maskEmail,
  normalizeAccountEmail,
} from "../src/lib/account-email.ts";

test("account email normalization trims and lowercases conservatively", () => {
  assert.equal(normalizeAccountEmail("  Mom.Example@EXAMPLE.COM  "), "mom.example@example.com");
});

test("account email normalization preserves plus aliases and dots", () => {
  assert.equal(
    normalizeAccountEmail("Resident.Name+House168@Example.COM"),
    "resident.name+house168@example.com",
  );
});

test("account email normalization handles Unicode without provider-specific rewriting", () => {
  assert.equal(normalizeAccountEmail("  ÜSER@例え.テスト  "), "üser@例え.テスト");
});

test("only terminal non-approved opening requests may release their email", () => {
  for (const status of ["REJECTED", "CANCELLED", "EXPIRED"]) {
    assert.equal(canReleaseOpeningRequestEmail(status), true, status);
  }
  for (const status of ["PENDING_EMAIL_VERIFICATION", "PENDING_REVIEW", "APPROVED"]) {
    assert.equal(canReleaseOpeningRequestEmail(status), false, status);
  }
});

test("only an unowned revoked AccountEmail may be reclaimed", () => {
  assert.equal(canReclaimAccountEmail({ status: "REVOKED", userId: null, residentHouseAccountId: null }), true);
  assert.equal(canReclaimAccountEmail({ status: "ACTIVE", userId: null, residentHouseAccountId: null }), false);
  assert.equal(canReclaimAccountEmail({ status: "REVOKED", userId: "user-1", residentHouseAccountId: null }), false);
  assert.equal(canReclaimAccountEmail({ status: "REVOKED", userId: null, residentHouseAccountId: "house-account-1" }), false);
});

test("email masking does not expose the local part", () => {
  assert.equal(maskEmail("mom@gmail.com"), "m***@gmail.com");
  assert.equal(maskEmail("x@example.org"), "x***@example.org");
  assert.equal(maskEmail("not-an-email"), "***");
});

test("AccountEmail state transitions are explicit", () => {
  assert.equal(canTransitionAccountEmail("PENDING_VERIFICATION", "VERIFIED_PENDING_REVIEW"), true);
  assert.equal(canTransitionAccountEmail("VERIFIED_PENDING_REVIEW", "ACTIVE"), true);
  assert.equal(canTransitionAccountEmail("ACTIVE", "PENDING_VERIFICATION"), false);
  assert.equal(canTransitionAccountEmail("REVOKED", "PENDING_VERIFICATION"), true);
});

test("reservation creates only when normalized identity is unused", () => {
  assert.equal(decideAccountEmailReservation({
    identity: null,
    targetOpeningRequestId: "request-1",
    previousOpeningRequestStatus: null,
  }), "CREATE");
});

test("active or legitimately reserved email cannot be reclaimed", () => {
  assert.equal(decideAccountEmailReservation({
    identity: {
      status: "ACTIVE",
      userId: "user-1",
      residentHouseAccountId: "house-account-1",
      openingRequestId: null,
    },
    targetOpeningRequestId: "request-2",
    previousOpeningRequestStatus: null,
  }), "CONFLICT");
  assert.equal(decideAccountEmailReservation({
    identity: {
      status: "PENDING_VERIFICATION",
      userId: null,
      residentHouseAccountId: null,
      openingRequestId: "request-1",
    },
    targetOpeningRequestId: "request-2",
    previousOpeningRequestStatus: "PENDING_EMAIL_VERIFICATION",
  }), "CONFLICT");
});

test("unowned revoked email is reclaimable only from a terminal eligible request", () => {
  const identity = {
    status: "REVOKED",
    userId: null,
    residentHouseAccountId: null,
    openingRequestId: "request-1",
  };
  assert.equal(decideAccountEmailReservation({
    identity,
    targetOpeningRequestId: "request-2",
    previousOpeningRequestStatus: "REJECTED",
  }), "RECLAIM");
  assert.equal(decideAccountEmailReservation({
    identity,
    targetOpeningRequestId: "request-2",
    previousOpeningRequestStatus: "APPROVED",
  }), "CONFLICT");
});
