import test from "node:test";
import assert from "node:assert/strict";
import {
  isHeadmanAccount,
  isResidentHouseAccount,
} from "../src/lib/account-kind.ts";

test("account-kind helpers recognize only their explicit account kind", () => {
  assert.equal(isHeadmanAccount("HEADMAN"), true);
  assert.equal(isHeadmanAccount("RESIDENT_HOUSE"), false);
  assert.equal(isResidentHouseAccount("RESIDENT_HOUSE"), true);
});

test("account-kind helpers do not infer unclassified accounts", () => {
  assert.equal(isResidentHouseAccount(undefined), false);
});
