import test from "node:test";
import assert from "node:assert/strict";
import { isValidHouseNumber, normalizeHouseNumber } from "../src/lib/house-number.ts";
import {
  HOUSE_ADDRESS_MAX_LENGTH,
  normalizeHouseAddress,
  parseOptionalHouseCoordinate,
  validateHouseAddress,
  validateHouseCoordinates,
} from "../src/lib/house-validation.ts";

test("house number keeps the existing canonical normalization and format", () => {
  assert.equal(normalizeHouseNumber(" ๑๖๘\\4 "), "168/4");
  assert.equal(isValidHouseNumber("168/4"), true);
  assert.equal(isValidHouseNumber("168-A"), true);
  assert.equal(isValidHouseNumber("168//4"), true);
  assert.equal(isValidHouseNumber("บ้าน 168"), false);
  assert.equal(isValidHouseNumber(""), false);
});

test("house address is optional, trimmed, and limited without truncation", () => {
  assert.equal(HOUSE_ADDRESS_MAX_LENGTH, 300);
  assert.equal(normalizeHouseAddress("   "), null);
  assert.equal(normalizeHouseAddress("  ซอย 1  "), "ซอย 1");
  assert.equal(validateHouseAddress("ก".repeat(300)), null);
  assert.equal(validateHouseAddress("ก".repeat(301)), "ที่อยู่เพิ่มเติมต้องไม่เกิน 300 ตัวอักษร");
});

test("house coordinates require a complete in-range pair", () => {
  for (const [latitude, longitude] of [[null, null], [90, 180], [-90, -180], [18.895, 98.95]]) {
    assert.equal(validateHouseCoordinates(latitude, longitude), null);
  }
  assert.equal(validateHouseCoordinates(90.0001, 0), "ละติจูดต้องอยู่ระหว่าง -90 ถึง 90");
  assert.equal(validateHouseCoordinates(-90.0001, 0), "ละติจูดต้องอยู่ระหว่าง -90 ถึง 90");
  assert.equal(validateHouseCoordinates(0, 180.0001), "ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180");
  assert.equal(validateHouseCoordinates(0, -180.0001), "ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180");
  assert.equal(validateHouseCoordinates(18.895, null), "กรุณาระบุละติจูดและลองจิจูดให้ครบทั้งสองค่า");
  assert.equal(validateHouseCoordinates(null, 98.95), "กรุณาระบุละติจูดและลองจิจูดให้ครบทั้งสองค่า");
  assert.equal(validateHouseCoordinates(Number.NaN, 0), "ละติจูดต้องอยู่ระหว่าง -90 ถึง 90");
  assert.equal(validateHouseCoordinates(0, Infinity), "ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180");
});

test("import coordinate parsing accepts numeric strings and rejects invalid values", () => {
  assert.equal(parseOptionalHouseCoordinate(" 18.895 ", "ละติจูด"), 18.895);
  assert.equal(parseOptionalHouseCoordinate(98.95, "ลองจิจูด"), 98.95);
  assert.equal(parseOptionalHouseCoordinate("", "ละติจูด"), null);
  assert.equal(parseOptionalHouseCoordinate(null, "ละติจูด"), null);
  assert.throws(() => parseOptionalHouseCoordinate("north", "ละติจูด"), /ละติจูด ต้องเป็นตัวเลขที่ถูกต้อง/);
  assert.throws(() => parseOptionalHouseCoordinate(Infinity, "ลองจิจูด"), /ลองจิจูด ต้องเป็นตัวเลขที่ถูกต้อง/);
});
