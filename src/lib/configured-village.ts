import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
export { ConfiguredVillageError, resolveConfiguredVillage } from "./configured-village-core.js";
import { ConfiguredVillageError, resolveConfiguredVillage } from "./configured-village-core.js";

export const configuredVillageSelect = {
  isActive: true,
  id: true,
  slug: true,
  name: true,
  moo: true,
  province: true,
  district: true,
  subdistrict: true,
} satisfies Prisma.VillageSelect;

export type ConfiguredVillage = Prisma.VillageGetPayload<{ select: typeof configuredVillageSelect }>;

/** The sole public/runtime Village. Legacy Village rows remain untouched. */
export async function getConfiguredVillage(): Promise<ConfiguredVillage> {
  const villages = await prisma.village.findMany({
    where: { isActive: true },
    select: configuredVillageSelect,
    take: 2,
    orderBy: { createdAt: "asc" },
  });
  return resolveConfiguredVillage(villages) as ConfiguredVillage;
}

export function configuredVillageProblemResponse(error: unknown) {
  return error instanceof ConfiguredVillageError
    ? { error: "Village installation is not configured correctly." }
    : null;
}
