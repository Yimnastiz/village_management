export type FinalAccountKind = "HEADMAN" | "RESIDENT_HOUSE" | "LEGACY_RESIDENT" | null;

export function isHeadmanPhoneLoginEligible(input: {
  accountKind: FinalAccountKind | undefined;
  accountStatus: string | undefined;
  hasActiveConfiguredHeadmanMembership: boolean;
}): boolean {
  const isHeadmanKind = input.accountKind === "HEADMAN" || input.accountKind === null;
  return isHeadmanKind && input.accountStatus === "ACTIVE" && input.hasActiveConfiguredHeadmanMembership;
}

export function isResidentHouseAccessEligible(input: {
  accountKind: FinalAccountKind | undefined;
  configuredVillageId: string | null;
  houseAccount: { villageId: string; houseId: string; activatedAt: Date | null; suspendedAt: Date | null } | null | undefined;
  membership: { villageId: string; houseId: string | null; role: string; status: string } | null | undefined;
}): boolean {
  const { houseAccount, membership } = input;
  return Boolean(
    input.accountKind === "RESIDENT_HOUSE" &&
    houseAccount?.activatedAt &&
    !houseAccount.suspendedAt &&
    membership?.role === "RESIDENT" &&
    membership.status === "ACTIVE" &&
    membership.houseId &&
    membership.houseId === houseAccount.houseId &&
    membership.villageId === houseAccount.villageId &&
    membership.villageId === input.configuredVillageId
  );
}
