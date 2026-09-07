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
  keyword?: string;
}) {
  const keyword = params.keyword?.trim();
  return prisma.villageEvent.findMany({
    where: {
      villageId: params.villageId,
      ...(params.publicOnly ? { isPublic: true } : {}),
      AND: [
        { startsAt: { lt: params.endsBefore } },
        { OR: [{ endsAt: { gte: params.startsAt } }, { endsAt: null, startsAt: { gte: params.startsAt } }] },
        ...(keyword ? [{ OR: [{ title: { contains: keyword, mode: "insensitive" as const } }, { location: { contains: keyword, mode: "insensitive" as const } }] }] : []),
      ],
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
