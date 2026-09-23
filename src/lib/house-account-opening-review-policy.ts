export type OpeningReviewEligibility =
  | "ELIGIBLE"
  | "ALREADY_APPROVED"
  | "ALREADY_REJECTED"
  | "REQUEST_NOT_REVIEWABLE"
  | "WRONG_VILLAGE"
  | "EMAIL_NOT_VERIFIED"
  | "HOUSE_ALREADY_ACTIVE"
  | "ALREADY_ACTIVATED";

export function openingReviewEligibility(input: {
  requestStatus: string;
  requestVillageId: string;
  houseVillageId: string;
  configuredVillageId: string;
  accountEmailStatus: string | null;
  accountEmailVerifiedAt: Date | null;
  hasResidentHouseAccount: boolean;
  activatedUserId: string | null;
}): OpeningReviewEligibility {
  if (input.requestVillageId !== input.configuredVillageId || input.houseVillageId !== input.configuredVillageId) {
    return "WRONG_VILLAGE";
  }
  if (input.requestStatus === "APPROVED") return "ALREADY_APPROVED";
  if (input.requestStatus === "REJECTED") return "ALREADY_REJECTED";
  if (input.requestStatus !== "PENDING_REVIEW") return "REQUEST_NOT_REVIEWABLE";
  if (input.activatedUserId) return "ALREADY_ACTIVATED";
  if (input.hasResidentHouseAccount) return "HOUSE_ALREADY_ACTIVE";
  if (input.accountEmailStatus !== "VERIFIED_PENDING_REVIEW" || !input.accountEmailVerifiedAt) {
    return "EMAIL_NOT_VERIFIED";
  }
  return "ELIGIBLE";
}

export function normalizeOpeningRejectionReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const reason = value.trim();
  return reason.length > 0 && reason.length <= 2_000 ? reason : null;
}

/** Pure activation plan shared by the transaction and focused policy tests. */
export function buildHouseAccountActivationData(input: {
  villageId: string;
  houseId: string;
  houseNumber: string;
  contactPhone: string;
  verifiedEmail: string;
  activatedAt: Date;
}) {
  return {
    user: {
      name: `บ้านเลขที่ ${input.houseNumber}`,
      email: input.verifiedEmail,
      emailVerified: true,
      phoneNumber: null,
      phoneNumberVerified: false,
      accountKind: "RESIDENT_HOUSE" as const,
    },
    residentHouseAccount: {
      villageId: input.villageId,
      houseId: input.houseId,
      contactPhone: input.contactPhone,
      activatedAt: input.activatedAt,
    },
    membership: {
      villageId: input.villageId,
      houseId: input.houseId,
      role: "RESIDENT" as const,
      status: "ACTIVE" as const,
      joinedAt: input.activatedAt,
    },
  };
}
