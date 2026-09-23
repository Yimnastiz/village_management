import test from "node:test";
import assert from "node:assert/strict";
import {
  createHouseLoginFlowToken,
  readHouseLoginFlowCookie,
  verifyHouseLoginFlowToken,
} from "../src/lib/house-account-login-access.ts";

const previousSecret = process.env.HOUSE_ACCOUNT_LOGIN_FLOW_SECRET;
process.env.HOUSE_ACCOUNT_LOGIN_FLOW_SECRET = "house-login-access-test-secret-123456789";

test.after(() => {
  if (previousSecret === undefined) delete process.env.HOUSE_ACCOUNT_LOGIN_FLOW_SECRET;
  else process.env.HOUSE_ACCOUNT_LOGIN_FLOW_SECRET = previousSecret;
});

test("signed House login flow token binds one opaque flow until expiry", () => {
  const now = new Date("2026-09-23T12:00:00.000Z");
  const expiresAt = new Date(now.getTime() + 300_000);
  const token = createHouseLoginFlowToken("flow-opaque", expiresAt);
  assert.deepEqual(verifyHouseLoginFlowToken(token, now), { flowId: "flow-opaque", expiresAt });
  assert.equal(readHouseLoginFlowCookie(`other=x; house_login_flow=${encodeURIComponent(token)}`), token);
});

test("tampered and expired House login flow tokens are rejected", () => {
  const now = new Date("2026-09-23T12:00:00.000Z");
  const token = createHouseLoginFlowToken("flow-opaque", new Date(now.getTime() + 1_000));
  assert.equal(verifyHouseLoginFlowToken(`${token}x`, now), null);
  assert.equal(verifyHouseLoginFlowToken(token, new Date(now.getTime() + 1_001)), null);
});
