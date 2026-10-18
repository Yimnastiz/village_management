import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeVillagePlaceInput, parseVillagePlacePayload } from "../src/lib/village-place.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const residentActions = read("src/app/(resident)/resident/places/requests/actions.ts");
const adminActions = read("src/app/(admin)/admin/places/actions.ts");
const reviewButtons = read("src/app/(admin)/admin/places/requests/request-review-buttons.tsx");

test("resident CREATE payload preserves the proposed visibility", () => {
  const input = { name: "ร้านชุมชน", category: "SHOP", description: "", address: "", openingHours: "", contactPhone: "", mapUrl: "", latitude: null, longitude: null, isPublic: true, images: [] };
  assert.equal(normalizeVillagePlaceInput(input).ok, true);
  assert.equal(parseVillagePlacePayload(input)?.isPublic, true);
  assert.doesNotMatch(residentActions, /isPublic:\s*false\s*}\s*;/);
});

test("resident DELETE requests use the DELETE enum and retain a reason snapshot", () => {
  assert.match(read("prisma/schema.prisma"), /enum VillagePlaceSubmissionType\s*{[^}]*DELETE/s);
  assert.match(residentActions, /type:\s*"DELETE"/);
  assert.match(residentActions, /requestReason:\s*reason/);
  assert.match(residentActions, /reason\.length < 5/);
});

test("UPDATE and DELETE submissions block conflicting pending requests", () => {
  const conflictChecks = residentActions.match(/type:\s*{\s*in:\s*\["UPDATE",\s*"DELETE"\]/g) ?? [];
  assert.ok(conflictChecks.length >= 2);
  assert.match(residentActions, /มีคำขอลบสถานที่นี้ที่รอพิจารณาอยู่แล้ว/);
});

test("admin CREATE and UPDATE approval apply final visibility and featured decisions", () => {
  assert.match(adminActions, /isPublic:\s*reviewOptions!\.isPublic/);
  assert.match(adminActions, /isFeatured:\s*reviewOptions!\.isFeatured/);
  assert.match(adminActions, /finalIsPublic/);
  assert.match(adminActions, /finalIsFeatured/);
  assert.match(reviewButtons, /การเผยแพร่เมื่ออนุมัติ/);
});

test("admin DELETE approval removes saves and the place while retaining submission history", () => {
  assert.match(adminActions, /submission\.type === "DELETE"/);
  assert.match(adminActions, /savedItem\.deleteMany/);
  assert.match(adminActions, /villagePlace\.delete/);
  assert.doesNotMatch(adminActions, /villagePlaceSubmission\.delete/);
});

test("DELETE rejection uses the existing reason flow and resident notification", () => {
  assert.match(adminActions, /คำขอลบสถานที่ของคุณไม่ได้รับการอนุมัติ/);
  assert.match(adminActions, /reviewNote:\s*reason/);
  assert.match(adminActions, /status:\s*"REJECTED"/);
});

test("headman deletion of a resident-originated place notifies its requester with the reason", () => {
  assert.match(adminActions, /approvedPlaceId:\s*placeId,\s*type:\s*"CREATE"/);
  assert.match(adminActions, /สถานที่ของคุณถูกลบ/);
  assert.match(adminActions, /เหตุผล:\s*\$\{reason\}/);
  assert.match(adminActions, /\/resident\/places\/requests\?tab=history/);
});
