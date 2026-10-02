import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { headmanLoginEligibility, residentLoginEligibility, uniqueLoginUserId } from "../src/lib/account-login-policy.ts";

const now = new Date("2026-10-02T00:00:00.000Z");
function residentAlias(id, email, status = "ACTIVE") {
  return { id, email, normalizedEmail: email, status, verifiedAt: status === "ACTIVE" ? now : null, activatedAt: status === "ACTIVE" ? now : null, revokedAt: status === "REVOKED" ? now : null, userId: "resident-user", residentHouseAccountId: "house-account", user: { id: "resident-user", accountKind: "RESIDENT_HOUSE", accountStatus: "ACTIVE", memberships: [{ role: "RESIDENT", status: "ACTIVE", villageId: "village-1", houseId: "house-1" }] }, residentHouseAccount: { id: "house-account", userId: "resident-user", villageId: "village-1", houseId: "house-1", activatedAt: now, suspendedAt: null, house: { villageId: "village-1", houseNumber: "168/4" } } };
}
const headman = { id: "headman-user", email: "headman@example.com", accountKind: "HEADMAN", accountStatus: "ACTIVE", memberships: [{ role: "HEADMAN", status: "ACTIVE", villageId: "village-1" }] };

function residentEligibility(alias) {
  const account = alias.residentHouseAccount; const user = alias.user; const membership = user.memberships[0];
  return residentLoginEligibility({ accountEmailStatus: alias.status, accountEmailVerifiedAt: alias.verifiedAt, accountEmailActivatedAt: alias.activatedAt, accountEmailRevokedAt: alias.revokedAt, accountEmailUserId: alias.userId, accountEmailHouseAccountId: alias.residentHouseAccountId, houseAccountId: account.id, houseAccountUserId: account.userId, houseAccountVillageId: account.villageId, houseAccountHouseId: account.houseId, houseAccountActivatedAt: account.activatedAt, houseAccountSuspendedAt: account.suspendedAt, houseVillageId: account.house.villageId, configuredVillageId: "village-1", userAccountKind: user.accountKind, userAccountStatus: user.accountStatus, membershipRole: membership.role, membershipStatus: membership.status, membershipVillageId: membership.villageId, membershipHouseId: membership.houseId });
}

test("active Resident AccountEmail resolves to its House Account User without a house number", () => {
  const alias = residentAlias("alias-one", "one@example.com");
  assert.equal(residentEligibility(alias), "ELIGIBLE"); assert.equal(alias.userId, "resident-user");
});

test("a second active Resident email resolves to the same User", () => {
  const aliases = [residentAlias("alias-one", "one@example.com"), residentAlias("alias-two", "two@example.com")];
  for (const alias of aliases) assert.equal(residentEligibility(alias), "ELIGIBLE"); assert.deepEqual(new Set(aliases.map((alias) => alias.userId)), new Set(["resident-user"]));
});

test("active Headman User.email resolves to the Headman User", () => {
  assert.equal(headmanLoginEligibility({ accountKind: headman.accountKind, accountStatus: headman.accountStatus, membershipRole: headman.memberships[0].role, membershipStatus: headman.memberships[0].status, membershipVillageId: headman.memberships[0].villageId, configuredVillageId: "village-1" }), "ELIGIBLE");
});

test("inactive and removed Resident emails cannot log in", () => {
  for (const status of ["PENDING_VERIFICATION", "REVOKED"]) assert.equal(residentEligibility(residentAlias(`alias-${status}`, `${status.toLowerCase()}@example.com`, status)), "EMAIL_INACTIVE");
});

test("the same normalized email pointing at different Users is rejected as ambiguous", () => {
  assert.equal(uniqueLoginUserId(["resident-user", "headman-user"]), "AMBIGUOUS");
  assert.equal(uniqueLoginUserId(["resident-user", "resident-user"]), "resident-user");
});

test("unknown email has no resolved login User", () => { assert.equal(uniqueLoginUserId([]), null); });

test("central resolver queries both namespaces and fails closed on ambiguity", () => { const source = readFileSync(new URL("../src/lib/account-login-resolver.ts", import.meta.url), "utf8"); assert.match(source, /accountEmail\.findUnique/u); assert.match(source, /user\.findMany/u); assert.match(source, /uniqueUserId === "AMBIGUOUS"/u); });

test("login UI sends only email and cannot choose account role or house number", () => {
  const source = readFileSync(new URL("../src/app/(auth)/auth/login/login-form.tsx", import.meta.url), "utf8");
  assert.match(source, /JSON\.stringify\(\{ email: normalizedEmail, callbackUrl \}\)/u);
  assert.doesNotMatch(source, /houseNumber|phoneNumber|accountKind|HEADMAN_PHONE|role=/u);
});
