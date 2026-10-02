import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { accountLoginAuthPlugin } from "../src/lib/account-login-auth-plugin.ts";

const flows = new Map([
  ["123e4567-e89b-42d3-a456-426614174001", { userId: "resident", accountKind: "RESIDENT_HOUSE", accountEmailId: "alias-resident", callbackUrl: "/resident/dashboard" }],
  ["123e4567-e89b-42d3-a456-426614174002", { userId: "headman", accountKind: "HEADMAN", accountEmailId: null, callbackUrl: "/admin/dashboard" }],
]);
function createTestAuth() {
  const now = new Date(); const database = { user: [{ id: "resident", name: "Resident", email: "resident@example.com", emailVerified: true, image: null, createdAt: now, updatedAt: now }, { id: "headman", name: "Headman", email: "headman@example.com", emailVerified: true, image: null, createdAt: now, updatedAt: now }], session: [], account: [], verification: [] }; const consumed = new Set();
  const plugin = accountLoginAuthPlugin({ async verifyAccountLoginOtp(_headers, input) { const item = flows.get(input.flowId); if (!item || input.code !== "123456" || consumed.has(input.flowId)) throw new Error("invalid"); return { ...item, challengeId: `challenge-${item.userId}`, villageId: "village-1", email: `${item.userId}@example.com`, normalizedEmail: `${item.userId}@example.com`, residentHouseAccountId: item.accountKind === "RESIDENT_HOUSE" ? "house-account" : null, houseId: item.accountKind === "RESIDENT_HOUSE" ? "house-1" : null, houseNumber: item.accountKind === "RESIDENT_HOUSE" ? "168/4" : null }; }, async consumeAccountLoginOtp(input) { if (consumed.has(input.flowId)) throw new Error("replay"); consumed.add(input.flowId); } });
  const auth = betterAuth({ baseURL: "http://localhost:3000", secret: "account-login-test-secret-with-32-characters", database: memoryAdapter(database), session: { cookieCache: { enabled: false }, additionalFields: { activeVillageId: { type: "string", required: false, input: false, returned: false }, loginAccountEmailId: { type: "string", required: false, input: false, returned: false } } }, plugins: [plugin], trustedOrigins: ["http://localhost:3000"] });
  return { auth, database };
}
async function login(auth, flowId) { return auth.api.verifyAccountLogin({ body: { flowId, code: "123456" }, headers: new Headers({ origin: "http://localhost:3000" }), returnHeaders: true }); }
test("valid Resident and Headman OTPs create Better Auth sessions for server-selected Users", async () => { const { auth, database } = createTestAuth(); const resident = await login(auth, [...flows.keys()][0]); const headmanResult = await login(auth, [...flows.keys()][1]); assert.equal(resident.response.landingPath, "/resident/dashboard"); assert.equal(headmanResult.response.landingPath, "/admin/dashboard"); assert.deepEqual(new Set(database.session.map((item) => item.userId)), new Set(["resident", "headman"])); assert.equal(database.session.find((item) => item.userId === "resident").loginAccountEmailId, "alias-resident"); assert.equal(database.session.find((item) => item.userId === "headman").loginAccountEmailId, null); });
test("one challenge cannot create a second session", async () => { const { auth, database } = createTestAuth(); const flowId = [...flows.keys()][0]; await login(auth, flowId); await assert.rejects(() => login(auth, flowId)); assert.equal(database.session.length, 1); });
test("plugin delegates session and cookie ownership to Better Auth", () => { const source = readFileSync(new URL("../src/lib/account-login-auth-plugin.ts", import.meta.url), "utf8"); assert.match(source, /internalAdapter\.createSession/u); assert.match(source, /setSessionCookie/u); assert.doesNotMatch(source, /prisma\.authSession\.create|set-cookie/iu); });
