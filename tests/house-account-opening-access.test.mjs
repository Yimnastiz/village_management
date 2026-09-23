import test from "node:test";
import assert from "node:assert/strict";
import {
  createHouseOpeningAccessToken,
  verifyHouseOpeningAccessToken,
} from "../src/lib/house-account-opening-access.ts";

const environment = {
  HOUSE_ACCOUNT_OPENING_ACCESS_SECRET: "test-house-opening-access-secret-1234567890",
};
const now = new Date("2026-09-23T10:00:00.000Z");

test("signed request access token proves the request id until expiry", () => {
  const token = createHouseOpeningAccessToken("request-1", now, environment, "test");
  const verified = verifyHouseOpeningAccessToken(token, now, environment, "test");
  assert.equal(verified?.requestId, "request-1");
  assert.notEqual(verified?.requestId, "request-2");
  assert.ok(verified?.expiresAt.getTime() > now.getTime());
});

test("tampered and expired request access tokens are rejected", () => {
  const token = createHouseOpeningAccessToken("request-1", now, environment, "test");
  assert.equal(verifyHouseOpeningAccessToken(`${token}x`, now, environment, "test"), null);
  assert.equal(
    verifyHouseOpeningAccessToken(token, new Date(now.getTime() + 31 * 60_000), environment, "test"),
    null,
  );
});

test("production requires an explicit strong request access secret", () => {
  assert.throws(
    () => createHouseOpeningAccessToken("request-1", now, { BETTER_AUTH_SECRET: "fallback" }, "production"),
    /HOUSE_ACCOUNT_OPENING_ACCESS_SECRET is required/,
  );
  assert.throws(
    () => createHouseOpeningAccessToken(
      "request-1",
      now,
      { HOUSE_ACCOUNT_OPENING_ACCESS_SECRET: "too-short" },
      "production",
    ),
    /must be at least 32 characters/,
  );
});
