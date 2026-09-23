import test from "node:test";
import assert from "node:assert/strict";
import {
  isHeadmanAccount,
  isLegacyResidentAccount,
  isResidentHouseAccount,
} from "../src/lib/account-kind.ts";

test("account-kind helpers recognize only their explicit account kind", () => {
  assert.equal(isHeadmanAccount("HEADMAN"), true);
  assert.equal(isHeadmanAccount("RESIDENT_HOUSE"), false);
  assert.equal(isResidentHouseAccount("RESIDENT_HOUSE"), true);
  assert.equal(isResidentHouseAccount("LEGACY_RESIDENT"), false);
  assert.equal(isLegacyResidentAccount("LEGACY_RESIDENT"), true);
});

test("account-kind helpers do not infer unclassified accounts", () => {
  assert.equal(isHeadmanAccount(null), false);
  assert.equal(isResidentHouseAccount(undefined), false);
  assert.equal(isLegacyResidentAccount(null), false);
});
