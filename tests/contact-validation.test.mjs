import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTACT_EMAIL_MAX_LENGTH,
  normalizeContactEmail,
  normalizeContactPhone,
  normalizeVillagePhone,
  validateContactEmail,
  validateContactPhone,
  validateVillagePhone,
} from "../src/lib/contact.ts";

test("directory contacts validate rather than silently stripping or truncating phone input", () => {
  assert.equal(normalizeContactPhone(" ๐๘๑๒๓๔๕๖๗๘ "), "0812345678");
  assert.equal(normalizeContactPhone("081-234-5678"), "081-234-5678");
  assert.match(validateContactPhone("081-234-5678") ?? "", /ตัวเลข/);
  assert.match(validateContactPhone("08123456789") ?? "", /3–10/);
  assert.equal(validateContactPhone("191"), null);
});

test("contact email shares normalization, format, and maximum length", () => {
  assert.equal(CONTACT_EMAIL_MAX_LENGTH, 320);
  assert.equal(normalizeContactEmail(" Contact@Example.COM "), "contact@example.com");
  assert.equal(validateContactEmail("contact@example.com"), null);
  assert.notEqual(validateContactEmail("contact.example.com"), null);
  assert.notEqual(validateContactEmail(`a@${"b".repeat(317)}.c`), null);
});

test("village phone remains flexible but has a safe character set and maximum length", () => {
  assert.equal(normalizeVillagePhone("  02  123  4567  "), "02 123 4567");
  assert.equal(validateVillagePhone("+66 (0)2-123-4567"), null);
  assert.equal(validateVillagePhone("extension ABC"), "รูปแบบหมายเลขโทรศัพท์ไม่ถูกต้อง");
  assert.equal(validateVillagePhone("1".repeat(51)), "หมายเลขโทรศัพท์ยาวเกินกำหนด");
});
