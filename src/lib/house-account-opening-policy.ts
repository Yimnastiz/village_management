import type { HouseAccountOpeningRequestStatus } from "@prisma/client";
import { isValidEmailAddress, normalizeAccountEmail } from "./account-email-normalization.js";
import { isValidPersonName, normalizePersonName, normalizeThaiPhoneInput, PERSON_NAME_MAX_LENGTH } from "./person-validation.ts";

export const LIVE_HOUSE_OPENING_STATUSES = [
  "PENDING_EMAIL_VERIFICATION",
  "PENDING_REVIEW",
] as const;

export type HouseAccountOpeningInput = {
  houseId: string;
  applicantFirstName: string;
  applicantLastName: string;
  contactPhone: string;
  email: string;
  privacyConsent: boolean;
};

export type ValidatedHouseAccountOpeningInput = {
  houseId: string;
  applicantFirstName: string;
  applicantLastName: string;
  contactPhone: string;
  email: string;
  normalizedEmail: string;
};

export type HouseAccountOpeningValidationError =
  | "HOUSE_REQUIRED"
  | "FIRST_NAME_REQUIRED"
  | "FIRST_NAME_TOO_LONG"
  | "FIRST_NAME_INVALID"
  | "LAST_NAME_REQUIRED"
  | "LAST_NAME_TOO_LONG"
  | "LAST_NAME_INVALID"
  | "CONTACT_PHONE_INVALID"
  | "EMAIL_INVALID"
  | "PRIVACY_CONSENT_REQUIRED";

export function normalizeContactPhone(value: string): string {
  return normalizeThaiPhoneInput(value);
}

export function validateHouseAccountOpeningInput(
  input: HouseAccountOpeningInput,
):
  | { success: true; value: ValidatedHouseAccountOpeningInput }
  | { success: false; errors: HouseAccountOpeningValidationError[] } {
  const errors: HouseAccountOpeningValidationError[] = [];
  const houseId = input.houseId.trim();
  const applicantFirstName = normalizePersonName(input.applicantFirstName);
  const applicantLastName = normalizePersonName(input.applicantLastName);
  const contactPhone = normalizeContactPhone(input.contactPhone);
  const email = input.email.trim();
  const normalizedEmail = normalizeAccountEmail(email);

  if (!houseId) errors.push("HOUSE_REQUIRED");
  if (!applicantFirstName) errors.push("FIRST_NAME_REQUIRED");
  else if (applicantFirstName.length > PERSON_NAME_MAX_LENGTH) errors.push("FIRST_NAME_TOO_LONG");
  else if (!isValidPersonName(applicantFirstName)) errors.push("FIRST_NAME_INVALID");
  if (!applicantLastName) errors.push("LAST_NAME_REQUIRED");
  else if (applicantLastName.length > PERSON_NAME_MAX_LENGTH) errors.push("LAST_NAME_TOO_LONG");
  else if (!isValidPersonName(applicantLastName)) errors.push("LAST_NAME_INVALID");
  if (!/^\d{10}$/.test(contactPhone)) errors.push("CONTACT_PHONE_INVALID");
  if (!isValidEmailAddress(normalizedEmail)) {
    errors.push("EMAIL_INVALID");
  }
  if (!input.privacyConsent) errors.push("PRIVACY_CONSENT_REQUIRED");

  return errors.length
    ? { success: false, errors }
    : {
        success: true,
        value: {
          houseId,
          applicantFirstName,
          applicantLastName,
          contactPhone,
          email,
          normalizedEmail,
        },
      };
}

export type HouseOpeningEligibility =
  | "ELIGIBLE"
  | "HOUSE_NOT_FOUND"
  | "WRONG_VILLAGE"
  | "HOUSE_ALREADY_ACTIVE";

export function houseOpeningEligibility(input: {
  houseExists: boolean;
  houseVillageId: string | null;
  configuredVillageId: string;
  hasResidentHouseAccount: boolean;
}): HouseOpeningEligibility {
  if (!input.houseExists) return "HOUSE_NOT_FOUND";
  if (input.houseVillageId !== input.configuredVillageId) return "WRONG_VILLAGE";
  if (input.hasResidentHouseAccount) return "HOUSE_ALREADY_ACTIVE";
  return "ELIGIBLE";
}

export function canApplicantCancelOpeningRequest(
  status: HouseAccountOpeningRequestStatus,
): boolean {
  return status === "PENDING_EMAIL_VERIFICATION" || status === "PENDING_REVIEW";
}
