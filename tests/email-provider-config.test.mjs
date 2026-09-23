import test from "node:test";
import assert from "node:assert/strict";
import { readEmailProviderConfig } from "../src/lib/email/email-provider-config.ts";
import { readEmailOtpConfig } from "../src/lib/email/email-otp-config.ts";

test("non-production defaults to the development console provider", () => {
  assert.deepEqual(readEmailProviderConfig({}, "development"), {
    provider: "console",
    nodeEnvironment: "development",
  });
});

test("production rejects console delivery and missing provider", () => {
  assert.throws(
    () => readEmailProviderConfig({ EMAIL_PROVIDER: "console" }, "production"),
    /forbidden in production/,
  );
  assert.throws(() => readEmailProviderConfig({}, "production"), /must be smtp/);
});

test("SMTP validates required fields and paired credentials", () => {
  assert.throws(
    () => readEmailProviderConfig({ EMAIL_PROVIDER: "smtp" }, "production"),
    /SMTP_USER and SMTP_PASSWORD|SMTP_HOST/,
  );
  const config = readEmailProviderConfig({
    EMAIL_PROVIDER: "smtp",
    SMTP_HOST: "smtp.example.com",
    SMTP_PORT: "587",
    SMTP_SECURE: "false",
    SMTP_USER: "mailer",
    SMTP_PASSWORD: "password",
    EMAIL_FROM: "Village <no-reply@example.com>",
  }, "production");
  assert.equal(config.provider, "smtp");
  assert.equal(config.port, 587);
});

test("production OTP config requires an independent strong secret", () => {
  assert.throws(
    () => readEmailOtpConfig({ BETTER_AUTH_SECRET: "ignored-in-production" }, "production"),
    /EMAIL_OTP_HASH_SECRET is required/,
  );
  assert.throws(
    () => readEmailOtpConfig({ EMAIL_OTP_HASH_SECRET: "short" }, "production"),
    /at least 32 characters/,
  );
});
