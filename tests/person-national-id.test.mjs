import test from "node:test";
import assert from "node:assert/strict";
import {
  INVALID_NATIONAL_ID_MESSAGE,
  LINKED_NATIONAL_ID_IMMUTABLE_MESSAGE,
  normalizeNewNationalId,
  resolveUpdatedNationalId,
} from "../src/lib/person-national-id.ts";

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
