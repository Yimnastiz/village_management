import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = async (path) => readFile(new URL(path, import.meta.url), "utf8");

test("unified login resolves active, Headman, and verified pending opening identities fail-closed", async () => {
  const resolver = await source("../src/lib/account-login-resolver.ts");
  assert.match(resolver, /kind: "PENDING_RESIDENT"/u);
  assert.match(resolver, /alias\.status === "VERIFIED_PENDING_REVIEW"/u);
  assert.match(resolver, /openingRequest\.status === "PENDING_REVIEW"/u);
  assert.match(resolver, /!openingRequest\.house\.residentHouseAccount/u);
  assert.match(resolver, /if \(alias\?\.openingRequest\) return \{ kind: "AMBIGUOUS" \}/u);
});

test("pending login uses the opening OTP and never creates a Better Auth session", async () => {
  const login = await source("../src/lib/account-login-service.ts");
  const plugin = await source("../src/lib/account-login-auth-plugin.ts");
  assert.match(login, /purpose: "HOUSE_OPENING"/u);
  assert.match(login, /consumePendingAccountLoginOtp/u);
  assert.match(plugin, /if \(login\.kind === "PENDING"\)/u);
  assert.match(plugin, /createHouseOpeningAccessToken\(login\.requestId\)/u);
  assert.match(plugin, /return ctx\.json\(\{ ok: true, landingPath: "\/resident\/dashboard" \}\)/u);
  const pendingBranch = plugin.split('if (login.kind === "PENDING")')[1].split('const identity = login.identity')[0];
  assert.doesNotMatch(pendingBranch, /createSession/u);
});

test("unavailable email is rejected before a login flow or OTP challenge is created", async () => {
  const login = await source("../src/lib/account-login-service.ts");
  const http = await source("../src/lib/account-login-http.ts");
  assert.match(login, /resolution\.kind !== "RESOLVED" && resolution\.kind !== "PENDING_RESIDENT"\) throw new AccountLoginError\("ACCOUNT_UNAVAILABLE"/u);
  assert.match(http, /ไม่สามารถเข้าสู่ระบบด้วยอีเมลนี้ได้/u);
});

test("the normal resident and Headman OTP purposes remain unchanged", async () => {
  const login = await source("../src/lib/account-login-service.ts");
  assert.match(login, /"HEADMAN_LOGIN" : "HOUSE_LOGIN"/u);
  assert.match(login, /\["HOUSE_LOGIN", "HEADMAN_LOGIN"\]/u);
});
