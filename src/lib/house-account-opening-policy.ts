import type { HouseAccountOpeningRequestStatus } from "@prisma/client";
import { normalizeAccountEmail } from "./account-email-normalization.js";

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
  | "LAST_NAME_REQUIRED"
  | "LAST_NAME_TOO_LONG"
  | "CONTACT_PHONE_INVALID"
  | "EMAIL_INVALID"
  | "PRIVACY_CONSENT_REQUIRED";

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeContactPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const localDigits = digits.startsWith("66") && digits.length === 11
    ? `0${digits.slice(2)}`
    : digits;
  return localDigits.slice(0, 10);
}

export function validateHouseAccountOpeningInput(
  input: HouseAccountOpeningInput,
):
  | { success: true; value: ValidatedHouseAccountOpeningInput }
  | { success: false; errors: HouseAccountOpeningValidationError[] } {
  const errors: HouseAccountOpeningValidationError[] = [];
  const houseId = input.houseId.trim();
  const applicantFirstName = normalizeName(input.applicantFirstName);
  const applicantLastName = normalizeName(input.applicantLastName);
  const contactPhone = normalizeContactPhone(input.contactPhone);
  const email = input.email.trim();
  const normalizedEmail = normalizeAccountEmail(email);

  if (!houseId) errors.push("HOUSE_REQUIRED");
  if (!applicantFirstName) errors.push("FIRST_NAME_REQUIRED");
  else if (applicantFirstName.length > 100) errors.push("FIRST_NAME_TOO_LONG");
  if (!applicantLastName) errors.push("LAST_NAME_REQUIRED");
  else if (applicantLastName.length > 100) errors.push("LAST_NAME_TOO_LONG");
  if (!/^\d{9,10}$/.test(contactPhone)) errors.push("CONTACT_PHONE_INVALID");
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || normalizedEmail.length > 320) {
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
  | "HOUSE_ALREADY_ACTIVE"
  | "HOUSE_REQUEST_ALREADY_PENDING";

export function houseOpeningEligibility(input: {
  houseExists: boolean;
  houseVillageId: string | null;
  configuredVillageId: string;
  hasResidentHouseAccount: boolean;
  hasLiveOpeningRequest: boolean;
}): HouseOpeningEligibility {
  if (!input.houseExists) return "HOUSE_NOT_FOUND";
  if (input.houseVillageId !== input.configuredVillageId) return "WRONG_VILLAGE";
  if (input.hasResidentHouseAccount) return "HOUSE_ALREADY_ACTIVE";
  if (input.hasLiveOpeningRequest) return "HOUSE_REQUEST_ALREADY_PENDING";
  return "ELIGIBLE";
}

export function canApplicantCancelOpeningRequest(
  status: HouseAccountOpeningRequestStatus,
): boolean {
  return status === "PENDING_EMAIL_VERIFICATION" || status === "PENDING_REVIEW";
}
