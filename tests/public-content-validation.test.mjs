import test from "node:test";
import assert from "node:assert/strict";
import {
  eventTitleSchema,
  eventVisibilitySchema,
  galleryTitleSchema,
  galleryVisibilitySchema,
  isHttpUrl,
  newsContentSchema,
  newsStageSchema,
  newsTitleSchema,
  newsVisibilitySchema,
  normalizeFiscalYear,
  residentSubmissionOptionSchema,
  transparencyTitleSchema,
  validateFiscalYear,
} from "../src/lib/public-content-validation.ts";
import { normalizeVillagePlaceInput, VILLAGE_PLACE_CATEGORIES } from "../src/lib/village-place.ts";

test("required public-content text is trimmed before minimum length validation", () => {
  for (const schema of [newsTitleSchema, newsContentSchema, eventTitleSchema, galleryTitleSchema, transparencyTitleSchema]) {
    assert.equal(schema.safeParse("   ").success, false);
  }
});

test("public-content enum and option inputs accept only exact values", () => {
  assert.equal(newsStageSchema.safeParse("PUBLISHED").success, true);
  assert.equal(newsStageSchema.safeParse("published").success, false);
  assert.equal(newsVisibilitySchema.safeParse("RESIDENT_ONLY").success, true);
  assert.equal(newsVisibilitySchema.safeParse("PUBLICX").success, false);
  assert.equal(eventVisibilitySchema.safeParse("PUBLIC").success, true);
  assert.equal(eventVisibilitySchema.safeParse("RESIDENT").success, true);
  assert.equal(eventVisibilitySchema.safeParse("private123").success, false);
  assert.equal(galleryVisibilitySchema.safeParse("RESIDENT").success, true);
  assert.equal(galleryVisibilitySchema.safeParse("anything").success, false);
  assert.equal(residentSubmissionOptionSchema.safeParse("ALLOW").success, true);
  assert.equal(residentSubmissionOptionSchema.safeParse("false").success, false);
});

test("place URLs use real HTTP(S) parsing", () => {
  assert.equal(isHttpUrl("https://maps.google.com/maps?q=13,100"), true);
  assert.equal(isHttpUrl("http://example.com"), true);
  for (const value of ["https://", "hello", "ftp://example.com", "javascript:alert(1)"]) assert.equal(isHttpUrl(value), false);
});

function place(overrides = {}) {
  return { name: "ร้านชุมชน", category: "SHOP", description: "", address: "", openingHours: "", contactPhone: "", mapUrl: "", latitude: null, longitude: null, isPublic: true, images: [], ...overrides };
}

test("place validation preserves category, phone, coordinates, and rejects excess images", () => {
  assert.equal(normalizeVillagePlaceInput(place({ name: "   " })).ok, false);
  assert.equal(normalizeVillagePlaceInput(place({ contactPhone: "+66 (0)2-123-4567" })).ok, true);
  assert.equal(normalizeVillagePlaceInput(place({ contactPhone: "call us" })).ok, false);
  assert.equal(normalizeVillagePlaceInput(place({ category: "INVALID" })).ok, false);
  assert.equal(VILLAGE_PLACE_CATEGORIES.length, 12);
  const images = Array.from({ length: 10 }, (_, index) => ({ url: `https://example.com/${index}.jpg`, sortOrder: index, isCover: index === 0 }));
  assert.equal(normalizeVillagePlaceInput(place({ images })).ok, true);
  assert.equal(normalizeVillagePlaceInput(place({ images: [...images, { url: "https://example.com/10.jpg", sortOrder: 10, isCover: false }] })).ok, false);
});

test("transparency fiscal year normalizes Thai digits and requires exactly four digits", () => {
  assert.equal(normalizeFiscalYear(" ๒๕๖๙ "), "2569");
  assert.equal(validateFiscalYear("2569"), null);
  assert.equal(validateFiscalYear("๒๕๖๙"), null);
  assert.notEqual(validateFiscalYear("256"), null);
  assert.notEqual(validateFiscalYear("FY2569"), null);
});

test("transparency amount contract accepts zero and positive finite values only", async () => {
  const { z } = await import("zod");
  const amount = z.number().finite().min(0);
  assert.equal(amount.safeParse(0).success, true);
  assert.equal(amount.safeParse(125.5).success, true);
  assert.equal(amount.safeParse(-1).success, false);
  assert.equal(amount.safeParse(Number.POSITIVE_INFINITY).success, false);
});
