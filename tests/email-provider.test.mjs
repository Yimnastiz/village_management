import test from "node:test";
import assert from "node:assert/strict";
import {
  InMemoryEmailProvider,
  sendOtpEmail,
} from "../src/lib/email/email-provider-contract.ts";
import { buildEmailOtpTemplate } from "../src/lib/email/email-template.ts";

const message = {
  to: "mom@example.com",
  code: "482731",
  purpose: "HOUSE_OPENING",
  ttlSeconds: 300,
};

test("in-memory provider captures recipient, purpose, and code without network I/O", async () => {
  const provider = new InMemoryEmailProvider();
  await sendOtpEmail(provider, message);
  assert.deepEqual(provider.deliveries, [message]);
});

test("provider failures propagate", async () => {
  const provider = new InMemoryEmailProvider(new Error("simulated delivery failure"));
  await assert.rejects(sendOtpEmail(provider, message), /simulated delivery failure/);
});

test("centralized template includes purpose-specific copy and plain/HTML OTP", () => {
  const template = buildEmailOtpTemplate(message);
  assert.match(template.subject, /บัญชีบ้าน/u);
  assert.match(template.text, /482731/u);
  assert.match(template.text, /5 นาที/u);
  assert.match(template.html, /482731/u);
});
