import { prisma } from "@/lib/prisma";
import { getSlugVariants, normalizeVillageSlugParam } from "@/lib/village-slug";

export async function getPublicVillageBySlug(rawSlug: string) {
  const slug = normalizeVillageSlugParam(rawSlug);
  return prisma.village.findFirst({
    where: { slug: { in: getSlugVariants(slug) }, isActive: true },
    select: { id: true, name: true, slug: true },
  });
}

export async function getVillageCalendarEvents(params: {
  villageId: string;
  startsAt: Date;
  endsBefore: Date;
  publicOnly: boolean;
}) {
  return prisma.villageEvent.findMany({
    where: {
      villageId: params.villageId,
      ...(params.publicOnly ? { isPublic: true } : {}),
      startsAt: { gte: params.startsAt, lt: params.endsBefore },
    },
    orderBy: [{ startsAt: "asc" }],
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      location: true,
      isPublic: true,
    },
  });
}
