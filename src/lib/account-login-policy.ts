export type ResidentLoginEligibility =
  | "ELIGIBLE"
  | "EMAIL_INACTIVE"
  | "IDENTITY_INCOMPLETE"
  | "ACCOUNT_INACTIVE"
  | "ACCOUNT_SUSPENDED"
  | "WRONG_VILLAGE"
  | "WRONG_HOUSE"
  | "IDENTITY_MISMATCH"
  | "MEMBERSHIP_INACTIVE";

export function residentLoginEligibility(input: {
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
  userAccountKind: string | null;
  userAccountStatus: string;
  membershipRole: string | null;
  membershipStatus: string | null;
  membershipVillageId: string | null;
  membershipHouseId: string | null;
}): ResidentLoginEligibility {
  if (input.accountEmailStatus !== "ACTIVE" || !input.accountEmailVerifiedAt || !input.accountEmailActivatedAt || input.accountEmailRevokedAt) return "EMAIL_INACTIVE";
  if (!input.accountEmailUserId || !input.accountEmailHouseAccountId) return "IDENTITY_INCOMPLETE";
  if (input.userAccountKind !== "RESIDENT_HOUSE" || input.userAccountStatus !== "ACTIVE") return "ACCOUNT_INACTIVE";
  if (!input.houseAccountActivatedAt || input.houseAccountSuspendedAt) return "ACCOUNT_SUSPENDED";
  if (input.houseAccountVillageId !== input.configuredVillageId || input.houseVillageId !== input.configuredVillageId || input.membershipVillageId !== input.configuredVillageId) return "WRONG_VILLAGE";
  if (input.membershipHouseId !== input.houseAccountHouseId) return "WRONG_HOUSE";
  if (input.accountEmailHouseAccountId !== input.houseAccountId || input.accountEmailUserId !== input.houseAccountUserId) return "IDENTITY_MISMATCH";
  if (input.membershipRole !== "RESIDENT" || input.membershipStatus !== "ACTIVE") return "MEMBERSHIP_INACTIVE";
  return "ELIGIBLE";
}

export function headmanLoginEligibility(input: {
  accountKind: string;
  accountStatus: string;
  membershipRole: string | null;
  membershipStatus: string | null;
  membershipVillageId: string | null;
  configuredVillageId: string;
}): "ELIGIBLE" | "ACCOUNT_INACTIVE" | "MEMBERSHIP_INACTIVE" | "WRONG_VILLAGE" {
  if (input.accountKind !== "HEADMAN" || input.accountStatus !== "ACTIVE") return "ACCOUNT_INACTIVE";
  if (input.membershipVillageId !== input.configuredVillageId) return "WRONG_VILLAGE";
  if (input.membershipRole !== "HEADMAN" || input.membershipStatus !== "ACTIVE") return "MEMBERSHIP_INACTIVE";
  return "ELIGIBLE";
}

export function uniqueLoginUserId(userIds: Array<string | null | undefined>): string | null | "AMBIGUOUS" {
  const distinct = [...new Set(userIds.filter((value): value is string => Boolean(value)))];
  if (distinct.length > 1) return "AMBIGUOUS";
  return distinct[0] ?? null;
}
