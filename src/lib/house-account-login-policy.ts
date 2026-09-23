export type HouseLoginEligibility =
  | "ELIGIBLE"
  | "EMAIL_INACTIVE"
  | "IDENTITY_INCOMPLETE"
  | "ACCOUNT_INACTIVE"
  | "ACCOUNT_SUSPENDED"
  | "WRONG_VILLAGE"
  | "WRONG_HOUSE"
  | "IDENTITY_MISMATCH"
  | "MEMBERSHIP_INACTIVE";

/** Fail-closed policy shared by start and post-OTP verification. */
export function houseLoginEligibility(input: {
  accountEmailStatus: string;
  accountEmailVerifiedAt: Date | null;
  accountEmailActivatedAt: Date | null;
  accountEmailRevokedAt: Date | null;
  accountEmailUserId: string | null;
  accountEmailHouseAccountId: string | null;
  houseAccountId: string;
  houseAccountUserId: string;
  houseAccountVillageId: string;
  houseAccountHouseId: string;
  houseAccountActivatedAt: Date | null;
  houseAccountSuspendedAt: Date | null;
  houseVillageId: string;
  configuredVillageId: string;
  enteredHouseId: string;
  userAccountKind: string | null;
  userAccountStatus: string;
  membershipRole: string | null;
  membershipStatus: string | null;
  membershipVillageId: string | null;
  membershipHouseId: string | null;
}): HouseLoginEligibility {
  if (
    input.accountEmailStatus !== "ACTIVE"
    || !input.accountEmailVerifiedAt
    || !input.accountEmailActivatedAt
    || input.accountEmailRevokedAt
  ) {
    return "EMAIL_INACTIVE";
  }
  if (!input.accountEmailUserId || !input.accountEmailHouseAccountId) {
    return "IDENTITY_INCOMPLETE";
  }
  if (input.userAccountKind !== "RESIDENT_HOUSE" || input.userAccountStatus !== "ACTIVE") {
    return "ACCOUNT_INACTIVE";
  }
  if (!input.houseAccountActivatedAt || input.houseAccountSuspendedAt) {
    return "ACCOUNT_SUSPENDED";
  }
  if (
    input.houseAccountVillageId !== input.configuredVillageId
    || input.houseVillageId !== input.configuredVillageId
    || input.membershipVillageId !== input.configuredVillageId
  ) {
    return "WRONG_VILLAGE";
  }
  if (
    input.enteredHouseId !== input.houseAccountHouseId
    || input.membershipHouseId !== input.houseAccountHouseId
  ) {
    return "WRONG_HOUSE";
  }
  if (
    input.accountEmailHouseAccountId !== input.houseAccountId
    || input.accountEmailUserId !== input.houseAccountUserId
  ) {
    return "IDENTITY_MISMATCH";
  }
  if (input.membershipRole !== "RESIDENT" || input.membershipStatus !== "ACTIVE") {
    return "MEMBERSHIP_INACTIVE";
  }
  return "ELIGIBLE";
}
