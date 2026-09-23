import test from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionEmailOtpChallenge,
  emailOtpResendEligibility,
  emailOtpVerificationEligibility,
  failedEmailOtpAttempt,
} from "../src/lib/email/email-otp-policy.ts";

const now = new Date("2026-09-23T10:00:00.000Z");

test("expired challenges are rejected", () => {
  assert.equal(emailOtpVerificationEligibility({
    status: "ACTIVE",
    expiresAt: new Date(now.getTime() - 1),
    attemptCount: 0,
    maxAttempts: 5,
  }, now), "EXPIRED");
});

test("the maximum failed attempt locks the challenge", () => {
  assert.deepEqual(failedEmailOtpAttempt(3, 5), { attemptCount: 4, status: "ACTIVE" });
  assert.deepEqual(failedEmailOtpAttempt(4, 5), { attemptCount: 5, status: "LOCKED" });
  assert.equal(emailOtpVerificationEligibility({
    status: "ACTIVE",
    expiresAt: new Date(now.getTime() + 60_000),
    attemptCount: 5,
    maxAttempts: 5,
  }, now), "LOCKED");
});

test("resend cooldown and maximum are enforced", () => {
  assert.equal(emailOtpResendEligibility({
    status: "ACTIVE",
    expiresAt: new Date(now.getTime() + 60_000),
    resendCount: 0,
    maxResends: 5,
    resendAvailableAt: new Date(now.getTime() + 1),
  }, now), "COOLDOWN");
  assert.equal(emailOtpResendEligibility({
    status: "ACTIVE",
    expiresAt: new Date(now.getTime() + 60_000),
    resendCount: 5,
    maxResends: 5,
    resendAvailableAt: now,
  }, now), "MAX_RESENDS");
  assert.equal(emailOtpResendEligibility({
    status: "ACTIVE",
    expiresAt: new Date(now.getTime() - 1),
    resendCount: 0,
    maxResends: 5,
    resendAvailableAt: now,
  }, now), "EXPIRED");
});

test("verified OTP is single-use and stale challenges cannot become valid again", () => {
  assert.equal(canTransitionEmailOtpChallenge("ACTIVE", "VERIFIED"), true);
  assert.equal(canTransitionEmailOtpChallenge("VERIFIED", "CONSUMED"), true);
  assert.equal(canTransitionEmailOtpChallenge("CONSUMED", "VERIFIED"), false);
  assert.equal(canTransitionEmailOtpChallenge("CANCELLED", "ACTIVE"), false);
  assert.equal(emailOtpVerificationEligibility({
    status: "CANCELLED",
    expiresAt: new Date(now.getTime() + 60_000),
    attemptCount: 0,
    maxAttempts: 5,
  }, now), "UNAVAILABLE");
});
