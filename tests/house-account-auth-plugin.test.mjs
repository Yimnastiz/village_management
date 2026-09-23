import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { houseAccountAuthPlugin } from "../src/lib/house-account-auth-plugin.ts";

const userId = "house-user-168";
const flowMom = "123e4567-e89b-42d3-a456-426614174001";
const flowDad = "123e4567-e89b-42d3-a456-426614174002";

function requestHeaders(cookie) {
  return new Headers({
    origin: "http://localhost:3000",
    ...(cookie ? { cookie } : {}),
  });
}

function cookieHeader(setCookies) {
  return setCookies.map((value) => value.split(";", 1)[0]).join("; ");
}

function createTestAuth() {
  const now = new Date();
  const database = {
    user: [{
      id: userId,
      name: "บ้านเลขที่ 168/4",
      email: "canonical@example.com",
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
    }],
    session: [],
    account: [],
    verification: [],
  };
  const consumed = new Set();
  const aliases = new Map([
    [flowMom, { accountEmailId: "alias-mom", email: "mom@example.com", challengeId: "challenge-mom" }],
    [flowDad, { accountEmailId: "alias-dad", email: "dad@example.com", challengeId: "challenge-dad" }],
  ]);
  const plugin = houseAccountAuthPlugin({
    async verifyHouseAccountLoginOtp(_headers, input) {
      const alias = aliases.get(input.flowId);
      if (!alias || input.code !== "123456" || consumed.has(alias.challengeId)) throw new Error("invalid");
      return {
        ...alias,
        userId,
        residentHouseAccountId: "house-account-168",
        villageId: "village-1",
        houseId: "house-168",
        houseNumber: "168/4",
        normalizedEmail: alias.email,
        callbackUrl: "/resident/dashboard",
      };
    },
    async consumeHouseAccountLoginOtp(input) {
      if (consumed.has(input.challengeId)) throw new Error("replay");
      consumed.add(input.challengeId);
    },
  });
  const auth = betterAuth({
    baseURL: "http://localhost:3000",
    secret: "house-login-test-secret-with-32-characters",
    database: memoryAdapter(database),
    session: {
      cookieCache: { enabled: false },
      additionalFields: {
        activeVillageId: { type: "string", required: false, input: false, returned: false },
        loginAccountEmailId: { type: "string", required: false, input: false, returned: false },
      },
    },
    plugins: [plugin],
    trustedOrigins: ["http://localhost:3000"],
  });
  return { auth, database };
}

async function login(auth, flowId) {
  return auth.api.verifyHouseAccountLogin({
    body: { flowId, code: "123456" },
    headers: requestHeaders(),
    returnHeaders: true,
  });
}

test("two aliases create Better Auth sessions for the same existing User with distinct attribution", async () => {
  const { auth, database } = createTestAuth();
  const mom = await login(auth, flowMom);
  const dad = await login(auth, flowDad);
  assert.equal(mom.response.ok, true);
  assert.equal(dad.response.ok, true);
  assert.equal(database.user.length, 1, "login must not create a User");
  assert.equal(database.session.length, 2);
  assert.deepEqual(new Set(database.session.map((session) => session.userId)), new Set([userId]));
  assert.deepEqual(
    new Set(database.session.map((session) => session.loginAccountEmailId)),
    new Set(["alias-mom", "alias-dad"]),
  );
  assert.deepEqual(new Set(database.session.map((session) => session.activeVillageId)), new Set(["village-1"]));
});

test("Better Auth owns the real cookie and getSession recognizes it", async () => {
  const { auth } = createTestAuth();
  const result = await login(auth, flowMom);
  const setCookies = result.headers.getSetCookie();
  const sessionCookie = setCookies.find((value) => /HttpOnly/i.test(value) && !/Max-Age=0/i.test(value));
  assert.ok(sessionCookie, "a Better Auth HTTP-only session cookie should be present");
  assert.match(sessionCookie, /SameSite=Lax/i);

  const session = await auth.api.getSession({
    headers: requestHeaders(cookieHeader(setCookies)),
  });
  assert.equal(session?.user.id, userId);
});

test("the same OTP challenge cannot produce a second session", async () => {
  const { auth, database } = createTestAuth();
  await login(auth, flowMom);
  await assert.rejects(() => login(auth, flowMom));
  assert.equal(database.session.length, 1);
});

test("standard Better Auth sign-out invalidates a House Account session", async () => {
  const { auth } = createTestAuth();
  const result = await login(auth, flowMom);
  const cookie = cookieHeader(result.headers.getSetCookie());
  const signedOut = await auth.api.signOut({
    headers: requestHeaders(cookie),
    returnHeaders: true,
  });
  assert.equal(signedOut.response.success, true);
  const ended = await auth.api.getSession({ headers: requestHeaders(cookie) });
  assert.equal(ended, null);
});

test("plugin source uses Better Auth session/cookie APIs and does not forge either", () => {
  const source = readFileSync(new URL("../src/lib/house-account-auth-plugin.ts", import.meta.url), "utf8");
  assert.match(source, /internalAdapter\.createSession/u);
  assert.match(source, /setSessionCookie\s*\(/u);
  assert.doesNotMatch(source, /prisma\.authSession\.create/u);
  assert.doesNotMatch(source, /set-cookie/iu);
});
