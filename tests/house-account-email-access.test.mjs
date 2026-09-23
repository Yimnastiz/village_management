import test from "node:test";
import assert from "node:assert/strict";
import {
  createHouseAccountEmailFlowToken,
  readHouseAccountEmailFlowCookie,
  verifyHouseAccountEmailFlowToken,
} from "../src/lib/house-account-email-access.ts";

const previousSecret = process.env.HOUSE_ACCOUNT_EMAIL_FLOW_SECRET;
process.env.HOUSE_ACCOUNT_EMAIL_FLOW_SECRET = "house-email-management-test-secret-123456";

test.after(() => {
  if (previousSecret === undefined) delete process.env.HOUSE_ACCOUNT_EMAIL_FLOW_SECRET;
  else process.env.HOUSE_ACCOUNT_EMAIL_FLOW_SECRET = previousSecret;
});

test("signed add-email state binds session, User, House Account, alias, and challenge", () => {
  const now = new Date("2026-09-23T12:00:00.000Z");
  const flow = {
    authSessionId: "session-1",
    userId: "user-1",
    residentHouseAccountId: "house-account-1",
    accountEmailId: "email-2",
    challengeId: "challenge-1",
    expiresAt: now.getTime() + 300_000,
  };
  const token = createHouseAccountEmailFlowToken(flow);
  assert.deepEqual(verifyHouseAccountEmailFlowToken(token, { now }), { version: 1, ...flow });
  assert.equal(readHouseAccountEmailFlowCookie(`a=b; house_account_email_flow=${encodeURIComponent(token)}`), token);
});

test("tampering and expiry fail closed while cancellation can inspect authentic expired state", () => {
  const now = new Date("2026-09-23T12:00:00.000Z");
  const token = createHouseAccountEmailFlowToken({
    authSessionId: "session-1", userId: "user-1", residentHouseAccountId: "house-account-1",
    accountEmailId: "email-2", challengeId: "challenge-1", expiresAt: now.getTime() + 1_000,
  });
  assert.equal(verifyHouseAccountEmailFlowToken(`${token}x`, { now }), null);
  const afterExpiry = new Date(now.getTime() + 1_001);
  assert.equal(verifyHouseAccountEmailFlowToken(token, { now: afterExpiry }), null);
  assert.equal(verifyHouseAccountEmailFlowToken(token, { now: afterExpiry, allowExpired: true })?.accountEmailId, "email-2");
});
