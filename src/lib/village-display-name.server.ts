import "server-only";
import { prisma } from "@/lib/prisma";
import { formatVillageLabel } from "@/lib/village-label";

export type VillageDisplayNameInput = {
  id: string;
  name: string;
  moo?: string | number | null;
  province?: string | null;
  district?: string | null;
  subdistrict?: string | null;
};

/**
 * Keeps village names concise, adding the moo only when the same name is used
 * by more than one village in the same subdistrict.
 */
export async function getVillageDisplayName(village: VillageDisplayNameInput): Promise<string> {
  if (
    !village.moo?.toString().trim() ||
    !village.province?.trim() ||
    !village.district?.trim() ||
    !village.subdistrict?.trim()
  ) {
    return village.name;
  }

  const duplicateCount = await prisma.village.count({
    where: {
      name: village.name,
      province: village.province,
      district: village.district,
      subdistrict: village.subdistrict,
    },
  });

  return duplicateCount > 1 ? formatVillageLabel(village.name, village.moo) : village.name;
}
