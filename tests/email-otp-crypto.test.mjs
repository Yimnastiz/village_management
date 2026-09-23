import test from "node:test";
import assert from "node:assert/strict";
import {
  generateEmailOtp,
  hashEmailOtp,
  hashEmailOtpAbuseContext,
  verifyEmailOtpHash,
} from "../src/lib/email/email-otp-crypto.ts";

const base = {
  normalizedEmail: "mom@example.com",
  purpose: "HOUSE_OPENING",
  secret: "test-secret-with-sufficient-entropy-123456",
};

test("OTP generator requests a cryptographically secure six-digit range", () => {
  let received;
  const code = generateEmailOtp((minimum, maximum) => {
    received = { minimum, maximum };
    return 42;
  });
  assert.deepEqual(received, { minimum: 0, maximum: 1_000_000 });
  assert.equal(code, "000042");
  assert.match(generateEmailOtp(), /^\d{6}$/);
});

test("salted scrypt verifies the correct OTP and rejects an incorrect OTP", async () => {
  const protectedCode = await hashEmailOtp({ ...base, code: "482731" });
  assert.equal(await verifyEmailOtpHash({ ...base, code: "482731", ...protectedCode }), true);
  assert.equal(await verifyEmailOtpHash({ ...base, code: "482732", ...protectedCode }), false);
});

test("the same OTP receives different salts and hashes", async () => {
  const first = await hashEmailOtp({ ...base, code: "482731" });
  const second = await hashEmailOtp({ ...base, code: "482731" });
  assert.notEqual(first.codeSalt, second.codeSalt);
  assert.notEqual(first.codeHash, second.codeHash);
});

test("abuse context is keyed and does not retain raw client data", () => {
  const raw = "203.0.113.10";
  const hashed = hashEmailOtpAbuseContext(raw, base.secret);
  assert.ok(hashed);
  assert.notEqual(hashed, raw);
  assert.equal(hashEmailOtpAbuseContext("  ", base.secret), null);
});
