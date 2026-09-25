import test from "node:test";
import assert from "node:assert/strict";
import { residentActorDisplay } from "../src/lib/resident-actor-display-core.ts";

const houseUser = {
  accountKind: "RESIDENT_HOUSE",
  name: "ชื่อผู้สมัครที่ไม่ใช่ตัวตนบัญชี",
  phoneNumber: null,
  residentHouseAccount: {
    villageId: "village-1",
    contactPhone: "0812345678",
    house: { houseNumber: "168/4" },
  },
};

test("Resident House Account displays authoritative House identity and contact", () => {
  assert.deepEqual(residentActorDisplay(houseUser, { villageId: "village-1" }), {
    label: "บ้านเลขที่ 168/4",
    secondaryLabel: "บัญชีบ้าน",
    contactPhone: "0812345678",
    houseNumber: "168/4",
    accountKind: "RESIDENT_HOUSE",
  });
});

test("Headman retains normal personal identity", () => {
  assert.deepEqual(residentActorDisplay({ accountKind: "HEADMAN", name: "ผู้ใหญ่ดี", phoneNumber: "0811111111", residentHouseAccount: null }), {
    label: "ผู้ใหญ่ดี", secondaryLabel: "ผู้ใหญ่บ้าน", contactPhone: "0811111111", houseNumber: null, accountKind: "HEADMAN",
  });
});

test("malformed or cross-village House Account fails to restrained House fallback", () => {
  assert.equal(residentActorDisplay({ ...houseUser, residentHouseAccount: null }).label, "บัญชีสมาชิก");
  const crossVillage = residentActorDisplay(houseUser, { villageId: "village-2" });
  assert.equal(crossVillage.label, "บัญชีสมาชิก");
  assert.equal(crossVillage.contactPhone, null);
});
