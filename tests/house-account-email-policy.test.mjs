import test from "node:test";
import assert from "node:assert/strict";
import {
  canAddAccountEmail,
  canRemoveAccountEmail,
  chooseCanonicalReplacement,
  MAX_HOUSE_ACCOUNT_EMAILS,
} from "../src/lib/house-account-email-policy.ts";

test("House Account allows at most ten active login emails", () => {
  assert.equal(MAX_HOUSE_ACCOUNT_EMAILS, 10);
  assert.equal(canAddAccountEmail(0), true);
  assert.equal(canAddAccountEmail(9), true);
  assert.equal(canAddAccountEmail(10), false);
});

test("the final active login email cannot be removed", () => {
  assert.equal(canRemoveAccountEmail(2), true);
  assert.equal(canRemoveAccountEmail(1), false);
  assert.equal(canRemoveAccountEmail(0), false);
});

test("canonical replacement is deterministic and prefers oldest activation", () => {
  const createdAt = new Date("2026-09-23T10:00:00.000Z");
  const chosen = chooseCanonicalReplacement([
    { id: "later", createdAt, activatedAt: new Date("2026-09-23T12:00:00.000Z") },
    { id: "oldest", createdAt, activatedAt: new Date("2026-09-23T11:00:00.000Z") },
  ]);
  assert.equal(chosen?.id, "oldest");
  assert.equal(chooseCanonicalReplacement([]), null);
});
