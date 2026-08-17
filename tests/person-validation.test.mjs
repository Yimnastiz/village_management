import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidPersonName,
  normalizePersonGender,
  normalizePersonName,
  PERSON_GENDER_VALUES,
  validateOptionalPersonDate,
} from "../src/lib/person-validation.ts";

test("person names accept Thai and international letter-based names", () => {
  for (const value of ["สมชาย", "ณัฐวุฒิ", "John", "Anne-Marie", "O'Connor"]) {
    assert.equal(isValidPersonName(value), true, value);
  }
});

test("person names reject digits, arbitrary punctuation, and emoji", () => {
  for (const value of ["สมชาย123", "123", "@@@", "🎸สมชาย", "John!!!"]) {
    assert.equal(isValidPersonName(value), false, value);
  }
  assert.equal(normalizePersonName("  Anne   Marie  "), "Anne Marie");
});

test("gender has a canonical whitelist and compatible legacy aliases", () => {
  for (const value of PERSON_GENDER_VALUES) assert.equal(normalizePersonGender(value), value);
  assert.equal(normalizePersonGender("MALE"), "ชาย");
  assert.equal(normalizePersonGender("Female"), "หญิง");
  for (const value of ["หมา", "แมว", "กีตาร์", "123"]) assert.equal(normalizePersonGender(value), null, value);
});

test("optional person dates reject invalid and future dates", () => {
  const today = new Date(2026, 7, 17);
  assert.deepEqual(validateOptionalPersonDate("", today), { valid: true, value: null });
  assert.equal(validateOptionalPersonDate("2000-02-29", today).valid, true);
  assert.deepEqual(validateOptionalPersonDate("2025-02-29", today), { valid: false, reason: "INVALID" });
  assert.deepEqual(validateOptionalPersonDate("2026-08-18", today), { valid: false, reason: "FUTURE" });
});
