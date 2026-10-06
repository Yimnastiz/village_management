import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const auditHelper = read("../src/lib/audit-log.ts");
const loginService = read("../src/lib/account-login-service.ts");
const emailManagement = read("../src/lib/house-account-email-management-service.ts");
const auditPage = read("../src/app/(admin)/admin/security/page.tsx");

test("central audit attribution keeps User as actor and adds House/session metadata", () => {
  assert.match(auditHelper, /AuditLog\.userId remains the User\/House Account identity/u);
  assert.match(auditHelper, /actorAccountKind:\s*user\.accountKind/u);
  assert.match(auditHelper, /actorHouseId:\s*houseAccount\.houseId/u);
  assert.match(auditHelper, /actorHouseNumber:\s*houseAccount\.house\.houseNumber/u);
  assert.match(auditHelper, /loginAccountEmailId:\s*session\.loginAccountEmailId/u);
  assert.match(auditHelper, /maskedLoginEmail:\s*maskEmail\(session\.loginAccountEmail\.email\)/u);
  assert.doesNotMatch(auditHelper, /fullLoginEmail|loginEmail:\s*session/u);
});

test("login and House email security actions use the centralized writer", () => {
  assert.match(loginService, /writeVillageAuditLog\(tx,[\s\S]*actorAuthSessionId:\s*input\.sessionId/u);
  assert.match(emailManagement, /HOUSE_ACCOUNT_EMAIL_ADDED[\s\S]*HOUSE_ACCOUNT_EMAIL_REMOVED/u);
  assert.match(emailManagement, /actorAuthSessionId:\s*current\.authSessionId/gu);
});

test("Headman audit display uses House snapshot and masked login as secondary text", () => {
  assert.match(auditPage, /metadata\.actorHouseNumber/u);
  assert.match(auditPage, /`บ้านเลขที่ \$\{snapshotHouseNumber\}`/u);
  assert.match(auditPage, /`เข้าสู่ระบบด้วย \$\{maskedLoginEmail\}`/u);
});

test("important Resident action modules pass the authenticated session to audit", () => {
  for (const path of [
    "../src/app/(resident)/resident/news/requests/actions.ts",
    "../src/app/(resident)/resident/calendar/requests/actions.ts",
    "../src/app/(resident)/resident/gallery/actions.ts",
    "../src/app/(resident)/resident/places/requests/actions.ts",
    "../src/app/(resident)/resident/contacts/actions.ts",
    "../src/app/(resident)/resident/issues/actions.ts",
    "../src/app/(resident)/resident/appointments/actions.ts",
  ]) {
    const source = read(path);
    assert.match(source, /writeVillageAuditLog/u, `${path} must use the centralized audit writer`);
    assert.match(source, /actorAuthSessionId/u, `${path} must attribute the authenticated session`);
  }
});
