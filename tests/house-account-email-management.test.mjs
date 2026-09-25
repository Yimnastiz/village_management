import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const service = readFileSync(new URL("../src/lib/house-account-email-management-service.ts", import.meta.url), "utf8");
const accountEmailService = readFileSync(new URL("../src/lib/account-email-service.ts", import.meta.url), "utf8");
const securityPage = readFileSync(new URL("../src/app/(resident)/resident/profile/security/page.tsx", import.meta.url), "utf8");
const profilePage = readFileSync(new URL("../src/app/(resident)/resident/profile/page.tsx", import.meta.url), "utf8");
const deletionPolicy = readFileSync(new URL("../src/lib/account-deletion.ts", import.meta.url), "utf8");

test("add flow reserves one HOUSE_ACCOUNT alias and uses only ADD_HOUSE_EMAIL OTP", () => {
  const addFlowSource = service.slice(0, service.indexOf("export async function removeHouseAccountEmail"));
  assert.match(accountEmailService, /source:\s*"HOUSE_ACCOUNT"/u);
  assert.match(accountEmailService, /status:\s*"PENDING_VERIFICATION"/u);
  assert.match(service, /purpose:\s*"ADD_HOUSE_EMAIL"/u);
  assert.match(service, /activateAccountEmailInTransaction/u);
  assert.doesNotMatch(service, /user\.create\s*\(/u);
  assert.doesNotMatch(service, /villageMembership\.create\s*\(/u);
  assert.doesNotMatch(service, /residentHouseAccount\.create\s*\(/u);
  assert.doesNotMatch(service, /houseAccountOpeningRequest\.create\s*\(/u);
  assert.doesNotMatch(addFlowSource, /user\.update\s*\(/u);
  assert.doesNotMatch(service, /contactPhone|\bperson\b/iu);
});

test("verification revalidates session and House ownership then consumes OTP once", () => {
  assert.match(service, /loadEligibleContext\(tx, session\)/u);
  assert.match(service, /assertOwnedFlow\(ownedFlow, current\)/u);
  assert.match(service, /consumeVerifiedEmailOtpChallenge/u);
  assert.match(service, /challenge\.purpose !== "ADD_HOUSE_EMAIL"/u);
  assert.match(service, /status:\s*"PENDING_VERIFICATION"/u);
});

test("cancel and delivery failure release pending aliases and cancel live challenges", () => {
  assert.match(service, /cleanupPendingEmail/u);
  assert.match(service, /status:\s*\{ in: \["PENDING_DELIVERY", "ACTIVE", "VERIFIED"\] \}/u);
  assert.match(service, /data:\s*\{ status: "CANCELLED" \}/u);
  assert.match(service, /releasePendingHouseAccountEmailInTransaction/u);
});

test("removal is owner-locked, protects last email, and revokes only alias sessions", () => {
  assert.match(service, /lockAccountEmailOwnerNamespace/u);
  assert.match(service, /canRemoveAccountEmail\(activeEmails\.length\)/u);
  assert.match(service, /revokeSessionsForAccountEmail\(target\.id, tx\)/u);
  assert.doesNotMatch(service, /authSession\.deleteMany/u);
  assert.match(service, /userId:\s*current\.userId/u);
  assert.match(service, /residentHouseAccountId:\s*current\.residentHouseAccountId/u);
});

test("canonical removal rotates User.email without changing User or House ownership", () => {
  assert.match(service, /chooseCanonicalReplacement\(remaining\)/u);
  assert.match(service, /data:\s*\{ email: replacement\.email, emailVerified: true \}/u);
  assert.match(service, /canonicalEmailRotated = true/u);
});

test("security and profile UI use only House Account semantics", () => {
  assert.match(securityPage, /session\.accountKind === "RESIDENT_HOUSE"/u);
  assert.match(securityPage, /HouseAccountEmailManager/u);
  assert.match(securityPage, /<AccountDeletionCard/u);
  assert.match(profilePage, /residentHouseAccount\.findUnique/u);
  assert.match(profilePage, /HouseAccountProfile/u);
  assert.doesNotMatch(profilePage, /ProfileDetails|prisma\.person/u);
  assert.match(deletionPolicy, /user\.accountKind === "RESIDENT_HOUSE"/u);
});

test("audit events carry House semantics and masked email only", () => {
  assert.match(service, /HOUSE_ACCOUNT_EMAIL_ADDED/u);
  assert.match(service, /HOUSE_ACCOUNT_EMAIL_REMOVED/u);
  assert.match(service, /maskedEmail:\s*maskEmail/u);
  assert.doesNotMatch(service, /metadata:[\s\S]{0,300}\botp\b/iu);
});

test("new active aliases remain compatible with Phase 6 AccountEmail House login", () => {
  const login = readFileSync(new URL("../src/lib/house-account-login-service.ts", import.meta.url), "utf8");
  assert.match(login, /accountEmail\.findUnique/u);
  assert.match(login, /status:\s*true/u);
  assert.match(login, /loginAccountEmailId:\s*input\.identity\.accountEmailId/u);
  assert.match(service, /status:\s*"ACTIVE"/u);
});
