import test from "node:test";
import assert from "node:assert/strict";
import {
  INVALID_NATIONAL_ID_MESSAGE,
  LINKED_NATIONAL_ID_IMMUTABLE_MESSAGE,
  normalizeNewNationalId,
  resolveUpdatedNationalId,
} from "../src/lib/person-national-id.ts";
import { isValidStrictThaiNationalId } from "../src/lib/thai-identity.ts";

const legacyNationalId = "1234567890123";
const validNationalId = "1101700203450";

test("an unchanged legacy ID is preserved exactly during an unlinked update", () => {
  assert.deepEqual(
    resolveUpdatedNationalId({ nationalId: legacyNationalId, userId: null }, legacyNationalId),
    { ok: true, nationalId: legacyNationalId, changed: false },
  );
});

test("a linked person's ID is preserved when unchanged and rejected when forged", () => {
  assert.deepEqual(
    resolveUpdatedNationalId({ nationalId: legacyNationalId, userId: "user-1" }, legacyNationalId),
    { ok: true, nationalId: legacyNationalId, changed: false },
  );
  assert.deepEqual(
    resolveUpdatedNationalId({ nationalId: legacyNationalId, userId: "user-1" }, validNationalId),
    { ok: false, message: LINKED_NATIONAL_ID_IMMUTABLE_MESSAGE },
  );
});

test("new and changed national IDs remain strictly validated", () => {
  assert.equal(normalizeNewNationalId(validNationalId), validNationalId);
  assert.throws(() => normalizeNewNationalId(legacyNationalId), { message: INVALID_NATIONAL_ID_MESSAGE });
  assert.deepEqual(
    resolveUpdatedNationalId({ nationalId: validNationalId, userId: null }, legacyNationalId),
    { ok: false, message: INVALID_NATIONAL_ID_MESSAGE },
  );
});

test("checksum bypass is development-only and preserves the strict digit format", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalBypass = process.env.DEV_BYPASS_THAI_NATIONAL_ID_CHECK;
  try {
    process.env.NODE_ENV = "development";
    process.env.DEV_BYPASS_THAI_NATIONAL_ID_CHECK = "false";
    assert.equal(isValidStrictThaiNationalId(legacyNationalId), false);

    process.env.DEV_BYPASS_THAI_NATIONAL_ID_CHECK = "true";
    assert.equal(isValidStrictThaiNationalId(legacyNationalId), true);
    assert.equal(isValidStrictThaiNationalId("12345"), false);
    assert.equal(isValidStrictThaiNationalId("12345678901AB"), false);

    process.env.NODE_ENV = "production";
    assert.equal(isValidStrictThaiNationalId(legacyNationalId), false);
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.DEV_BYPASS_THAI_NATIONAL_ID_CHECK = originalBypass;
  }
});
