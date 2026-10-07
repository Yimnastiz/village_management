import test from "node:test";
import assert from "node:assert/strict";
import {
  isPendingResidentPathAllowed,
  isPendingResidentRequestEligible,
} from "../src/lib/pending-resident-policy.ts";
import {
  residentAlbumWhere,
  residentContentVisibility,
} from "../src/lib/resident-content-access.ts";
import { readFile } from "node:fs/promises";

const baseRequest = {
  requestStatus: "PENDING_REVIEW",
  requestVillageId: "configured-village",
  configuredVillageId: "configured-village",
  emailVerifiedAt: new Date("2026-10-06T00:00:00.000Z"),
};

test("only a verified PENDING_REVIEW request for the configured Village is eligible", () => {
  assert.equal(isPendingResidentRequestEligible(baseRequest), true);
  assert.equal(isPendingResidentRequestEligible({ ...baseRequest, emailVerifiedAt: null }), false);
  assert.equal(isPendingResidentRequestEligible({ ...baseRequest, requestVillageId: "other-village" }), false);
  for (const requestStatus of ["PENDING_EMAIL_VERIFICATION", "APPROVED", "REJECTED", "CANCELLED", "EXPIRED"]) {
    assert.equal(isPendingResidentRequestEligible({ ...baseRequest, requestStatus }), false);
  }
});

test("pending applicants may open only public Resident list and detail routes", () => {
  for (const pathname of [
    "/resident",
    "/resident/dashboard",
    "/resident/news",
    "/resident/news/public-id",
    "/resident/calendar",
    "/resident/gallery",
    "/resident/places",
    "/resident/downloads",
    "/resident/transparency",
    "/resident/contacts",
  ]) assert.equal(isPendingResidentPathAllowed(pathname), true, pathname);

  for (const pathname of [
    "/resident/issues",
    "/resident/issues/issue-id",
    "/resident/appointments",
    "/resident/household",
    "/resident/saved",
    "/resident/notifications",
    "/resident/profile",
    "/resident/profile/security",
    "/resident/news/requests",
    "/resident/news/public-id/request-edit",
    "/resident/gallery/public-id/request",
    "/resident/places/requests",
  ]) assert.equal(isPendingResidentPathAllowed(pathname), false, pathname);
});

test("pending content access uses the same public-only visibility filters", () => {
  assert.equal(residentContentVisibility(false), "PUBLIC");
  assert.deepEqual(residentAlbumWhere(false), { isPublic: true });
  assert.deepEqual(residentContentVisibility(true), { in: ["PUBLIC", "RESIDENT_ONLY"] });
  assert.deepEqual(residentAlbumWhere(true), {});
});

test("Resident mutation API still requires a real session and Resident membership", async () => {
  const source = await readFile(new URL("../src/app/api/gallery/images/route.ts", import.meta.url), "utf8");
  assert.match(source, /getSessionContextFromRequest\(request\)/);
  assert.match(source, /getResidentMembership\(session\)/);
  assert.match(source, /if \(!session\?\.id\).*status: 401/);
  assert.doesNotMatch(source, /PendingResident/);
});
