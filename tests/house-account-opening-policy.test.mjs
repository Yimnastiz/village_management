import test from "node:test";
import assert from "node:assert/strict";
import {
  canApplicantCancelOpeningRequest,
  houseOpeningEligibility,
  normalizeContactPhone,
  validateHouseAccountOpeningInput,
} from "../src/lib/house-account-opening-policy.ts";

const validInput = {
  houseId: "house-1",
  applicantFirstName: " สมชาย ",
  applicantLastName: " ใจดี ",
  contactPhone: "081-234-5678",
  email: " Home@Example.COM ",
  privacyConsent: true,
};

test("opening input trims names and normalizes contact phone and email", () => {
  const result = validateHouseAccountOpeningInput(validInput);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.value.applicantFirstName, "สมชาย");
  assert.equal(result.value.applicantLastName, "ใจดี");
  assert.equal(result.value.contactPhone, "0812345678");
  assert.equal(result.value.normalizedEmail, "home@example.com");
});

test("Thai contact phone accepts common 9-10 digit forms and rejects invalid input", () => {
  assert.equal(normalizeContactPhone("+66 81 234 5678"), "0812345678");
  assert.equal(validateHouseAccountOpeningInput({ ...validInput, contactPhone: "02-123-4567" }).success, true);
  const invalid = validateHouseAccountOpeningInput({ ...validInput, contactPhone: "1234" });
  assert.equal(invalid.success, false);
  if (!invalid.success) assert.ok(invalid.errors.includes("CONTACT_PHONE_INVALID"));
});

test("required applicant, email, house, and consent fields are validated", () => {
  const result = validateHouseAccountOpeningInput({
    houseId: "",
    applicantFirstName: "",
    applicantLastName: "",
    contactPhone: "",
    email: "not-an-email",
    privacyConsent: false,
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.deepEqual(new Set(result.errors), new Set([
      "HOUSE_REQUIRED",
      "FIRST_NAME_REQUIRED",
      "LAST_NAME_REQUIRED",
      "CONTACT_PHONE_INVALID",
      "EMAIL_INVALID",
      "PRIVACY_CONSENT_REQUIRED",
    ]));
  }
});

test("House opening eligibility rejects wrong Village, active account, and live request", () => {
  const base = {
    houseExists: true,
    houseVillageId: "village-1",
    configuredVillageId: "village-1",
    hasResidentHouseAccount: false,
    hasLiveOpeningRequest: false,
  };
  assert.equal(houseOpeningEligibility(base), "ELIGIBLE");
  assert.equal(houseOpeningEligibility({ ...base, houseExists: false }), "HOUSE_NOT_FOUND");
  assert.equal(houseOpeningEligibility({ ...base, houseVillageId: "village-2" }), "WRONG_VILLAGE");
  assert.equal(houseOpeningEligibility({ ...base, hasResidentHouseAccount: true }), "HOUSE_ALREADY_ACTIVE");
  assert.equal(houseOpeningEligibility({ ...base, hasLiveOpeningRequest: true }), "HOUSE_REQUEST_ALREADY_PENDING");
});

test("applicant cancellation is limited to the two live request states", () => {
  assert.equal(canApplicantCancelOpeningRequest("PENDING_EMAIL_VERIFICATION"), true);
  assert.equal(canApplicantCancelOpeningRequest("PENDING_REVIEW"), true);
  assert.equal(canApplicantCancelOpeningRequest("APPROVED"), false);
  assert.equal(canApplicantCancelOpeningRequest("CANCELLED"), false);
});
