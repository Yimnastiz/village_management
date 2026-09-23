import type { AccountEmailStatus, HouseAccountOpeningRequestStatus } from "@prisma/client";
export { maskEmail, normalizeAccountEmail } from "./account-email-normalization.js";

/**
 * Normalize an email for the global account-identity namespace.
 *
 * This deliberately avoids provider-specific rewriting: dots and plus tags
 * remain significant because not every provider treats them as aliases.
 */
const RELEASABLE_OPENING_REQUEST_STATUSES = new Set<HouseAccountOpeningRequestStatus>([
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
]);

export function canReleaseOpeningRequestEmail(
  status: HouseAccountOpeningRequestStatus,
): boolean {
  return RELEASABLE_OPENING_REQUEST_STATUSES.has(status);
}

export function canReclaimAccountEmail(identity: {
  status: AccountEmailStatus;
  userId: string | null;
  residentHouseAccountId: string | null;
}): boolean {
  return identity.status === "REVOKED"
    && identity.userId === null
    && identity.residentHouseAccountId === null;
}

const ACCOUNT_EMAIL_TRANSITIONS: Record<AccountEmailStatus, ReadonlySet<AccountEmailStatus>> = {
  PENDING_VERIFICATION: new Set(["VERIFIED_PENDING_REVIEW", "ACTIVE", "REVOKED"]),
  VERIFIED_PENDING_REVIEW: new Set(["ACTIVE", "REVOKED"]),
  ACTIVE: new Set(["REVOKED"]),
  REVOKED: new Set(["PENDING_VERIFICATION"]),
};

export function canTransitionAccountEmail(
  from: AccountEmailStatus,
  to: AccountEmailStatus,
): boolean {
  return ACCOUNT_EMAIL_TRANSITIONS[from].has(to);
}

export type AccountEmailReservationDecision = "CREATE" | "IDEMPOTENT" | "RECLAIM" | "CONFLICT";

export function decideAccountEmailReservation(input: {
  identity: {
    status: AccountEmailStatus;
    userId: string | null;
    residentHouseAccountId: string | null;
    openingRequestId: string | null;
  } | null;
  targetOpeningRequestId: string;
  previousOpeningRequestStatus: HouseAccountOpeningRequestStatus | null;
}): AccountEmailReservationDecision {
  if (!input.identity) return "CREATE";
  if (
    input.identity.openingRequestId === input.targetOpeningRequestId
    && (input.identity.status === "PENDING_VERIFICATION"
      || input.identity.status === "VERIFIED_PENDING_REVIEW")
  ) {
    return "IDEMPOTENT";
  }
  if (
    canReclaimAccountEmail(input.identity)
    && input.previousOpeningRequestStatus !== null
    && canReleaseOpeningRequestEmail(input.previousOpeningRequestStatus)
  ) {
    return "RECLAIM";
  }
  return "CONFLICT";
}
