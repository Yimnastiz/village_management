import { VillagePlaceCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSlugVariants, normalizeVillageSlugParam } from "@/lib/village-slug";

const publicPlaceCategories = [
  VillagePlaceCategory.TEMPLE,
  VillagePlaceCategory.CLINIC,
  VillagePlaceCategory.SCHOOL,
  VillagePlaceCategory.GOVERNMENT,
  VillagePlaceCategory.COMMUNITY,
] as const;

/** Public, village-level profile only. It deliberately excludes residents and houses. */
export async function getPublicVillageProfile(rawVillageSlug: string) {
  const villageSlug = normalizeVillageSlugParam(rawVillageSlug);
  const village = await prisma.village.findFirst({
    where: { slug: { in: getSlugVariants(villageSlug) }, isActive: true },
    select: {
      id: true,
      name: true,
      moo: true,
      description: true,
      address: true,
      phone: true,
      email: true,
      website: true,
      province: true,
      district: true,
      subdistrict: true,
      catalogVillage: {
        select: {
          officialCode: true,
          latitude: true,
          longitude: true,
          populationTotal: true,
          malePopulation: true,
          femalePopulation: true,
          householdCount: true,
          sourceName: true,
          sourceUrl: true,
          sourceUpdatedAt: true,
        },
      },
    },
  });

  if (!village) return null;

  const counts = await prisma.villagePlace.groupBy({
    by: ["category"],
    where: { villageId: village.id, isPublic: true, category: { in: [...publicPlaceCategories] } },
    _count: { _all: true },
  });

  return {
    villageSlug,
    village,
    placeCounts: new Map(counts.map((item) => [item.category, item._count._all])),
  };
}
