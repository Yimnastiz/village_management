import test from "node:test";
import assert from "node:assert/strict";
import { createAccountLoginFlowToken, readAccountLoginFlowCookie, verifyAccountLoginFlowToken } from "../src/lib/account-login-access.ts";
const previous = process.env.ACCOUNT_LOGIN_FLOW_SECRET;
process.env.ACCOUNT_LOGIN_FLOW_SECRET = "account-login-access-test-secret-123456789";
test.after(() => { if (previous === undefined) delete process.env.ACCOUNT_LOGIN_FLOW_SECRET; else process.env.ACCOUNT_LOGIN_FLOW_SECRET = previous; });
test("signed account login token binds one opaque flow until expiry", () => { const now = new Date("2026-10-02T00:00:00.000Z"); const expiresAt = new Date(now.getTime() + 300_000); const token = createAccountLoginFlowToken("flow-opaque", expiresAt); assert.deepEqual(verifyAccountLoginFlowToken(token, now), { flowId: "flow-opaque", expiresAt }); assert.equal(readAccountLoginFlowCookie(`x=1; account_login_flow=${encodeURIComponent(token)}`), token); assert.equal(verifyAccountLoginFlowToken(`${token}x`, now), null); });
