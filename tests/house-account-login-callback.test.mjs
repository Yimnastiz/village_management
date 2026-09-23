import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeResidentCallbackUrl } from "../src/lib/callback-url.ts";

test("House login may honor a safe internal callback", () => {
  assert.equal(sanitizeResidentCallbackUrl("/resident/issues/abc?from=login"), "/resident/issues/abc?from=login");
});

test("external and encoded redirect escapes are rejected", () => {
  assert.equal(sanitizeResidentCallbackUrl("https://evil.example/path"), null);
  assert.equal(sanitizeResidentCallbackUrl("//evil.example/path"), null);
  assert.equal(sanitizeResidentCallbackUrl("/%2f%2fevil.example"), null);
  assert.equal(sanitizeResidentCallbackUrl("/\\evil.example"), null);
  assert.equal(sanitizeResidentCallbackUrl("/admin/dashboard"), null);
});
