export type ResidentActorDisplay = {
  label: string;
  secondaryLabel: string | null;
  contactPhone: string | null;
  houseNumber: string | null;
  accountKind: "HEADMAN" | "RESIDENT_HOUSE" | "LEGACY_RESIDENT" | null;
};

type ResidentActorInput = {
  accountKind: "HEADMAN" | "RESIDENT_HOUSE" | "LEGACY_RESIDENT" | null;
  name: string | null;
  phoneNumber: string | null;
  residentHouseAccount: {
    villageId: string;
    contactPhone: string;
    house: { houseNumber: string };
  } | null;
};

export function residentActorDisplay(
  user: ResidentActorInput | null | undefined,
  options: { villageId?: string | null } = {},
): ResidentActorDisplay {
  if (user?.accountKind === "RESIDENT_HOUSE") {
    const houseAccount = user.residentHouseAccount;
    const inVillage = !options.villageId || houseAccount?.villageId === options.villageId;
    const houseNumber = inVillage ? houseAccount?.house.houseNumber?.trim() || null : null;
    return {
      label: houseNumber ? `บ้านเลขที่ ${houseNumber}` : "บัญชีสมาชิก",
      secondaryLabel: "บัญชีบ้าน",
      contactPhone: inVillage ? houseAccount?.contactPhone?.trim() || null : null,
      houseNumber,
      accountKind: "RESIDENT_HOUSE",
    };
  }

  return {
    label: user?.name?.trim() || "ผู้ใช้งาน",
    secondaryLabel: user?.accountKind === "HEADMAN" ? "ผู้ใหญ่บ้าน" : null,
    contactPhone: user?.phoneNumber?.trim() || null,
    houseNumber: null,
    accountKind: user?.accountKind ?? null,
  };
}
