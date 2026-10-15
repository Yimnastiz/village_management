import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const registerFormPath = new URL("../src/app/(auth)/auth/register/register-form.tsx", import.meta.url);
const startRoutePath = new URL("../src/app/api/auth/house-account-opening/start/route.ts", import.meta.url);
const servicePath = new URL("../src/lib/house-account-opening-service.ts", import.meta.url);

test("editing from the OTP screen is local navigation, not cancellation", async () => {
  const source = await readFile(registerFormPath, "utf8");
  assert.match(source, /function editRequest\(\)[\s\S]*?setStep\("FORM"\)/);
  assert.match(source, /onClick=\{editRequest\}[\s\S]*?>กลับไปแก้ไขข้อมูล<\/button>/);
  assert.doesNotMatch(source, /cancelRequest\(true\)/);
  assert.match(source, /onClick=\{\(\) => void cancelRequest\(\)\}>ยกเลิกคำขอ/);
});

test("start continuation is authorized by the signed opening access cookie", async () => {
  const source = await readFile(startRoutePath, "utf8");
  assert.match(source, /readHouseOpeningAccess\(request\)/);
  assert.match(source, /existingRequestId: access\?\.requestId/);
});

test("same-email continuation returns the original server timestamps without sending OTP", async () => {
  const source = await readFile(servicePath, "utf8");
  assert.match(source, /requestId: current\.id,[\s\S]*?existingChallenge: reusable/);
  assert.match(source, /challengeId: prepared\.existingChallenge\.challengeId/);
  assert.match(source, /expiresAt: prepared\.existingChallenge\.expiresAt/);
  assert.match(source, /resendAvailableAt: prepared\.existingChallenge\.resendAvailableAt/);
  assert.match(source, /sentOtp: false/);
  assert.ok(
    source.indexOf("if (prepared.existingChallenge)") < source.indexOf("issueEmailOtpChallenge({"),
    "the reusable challenge must return before the email sender is reached",
  );
});

test("changed email cancels the old live challenge and rotates the reservation", async () => {
  const source = await readFile(servicePath, "utf8");
  assert.match(source, /decision === "ROTATE_EMAIL"[\s\S]*?status: \{ in: \["PENDING_DELIVERY", "ACTIVE", "VERIFIED"\] \}[\s\S]*?rotateOpeningRequestEmailInTransaction/);
  assert.match(source, /issueEmailOtpChallenge\(\{[\s\S]*?email: prepared\.email/);
  assert.match(source, /challenge\.normalizedEmail !== openingRequest\.initialEmail\.normalizedEmail/);
  assert.match(source, /challengeId: challenge\.challengeId[\s\S]*?sentOtp: true/);
});

test("direct same-email starts cannot reset cooldown and legitimate cancellation remains", async () => {
  const [routeSource, serviceSource, registerSource] = await Promise.all([
    readFile(startRoutePath, "utf8"),
    readFile(servicePath, "utf8"),
    readFile(registerFormPath, "utf8"),
  ]);
  assert.match(routeSource, /readHouseOpeningAccess\(request\)/);
  assert.match(serviceSource, /REUSE_ACTIVE_CHALLENGE/);
  assert.match(serviceSource, /resendAvailableAt: prepared\.existingChallenge\.resendAvailableAt/);
  assert.match(registerSource, /fetch\("\/api\/auth\/house-account-opening\/cancel"/);
  assert.match(registerSource, />ยกเลิกคำขอ<\/Button>/);
});
