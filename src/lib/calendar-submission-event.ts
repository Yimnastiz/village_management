import { prisma } from "@/lib/prisma";

type ApprovedSubmissionSource = {
  eventId: string | null;
  villageId: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date | null;
  isPublic: boolean;
};

const eventSelection = {
  id: true,
  title: true,
  description: true,
  location: true,
  startsAt: true,
  endsAt: true,
  isPublic: true,
} as const;

/** Resolve only an explicit link or one unambiguous exact legacy match. */
export async function resolveApprovedSubmissionEvent(source: ApprovedSubmissionSource) {
  if (source.eventId) {
    const linked = await prisma.villageEvent.findFirst({
      where: { id: source.eventId, villageId: source.villageId },
      select: eventSelection,
    });
    if (linked) return linked;
  }

  const candidates = await prisma.villageEvent.findMany({
    where: {
      villageId: source.villageId,
      title: source.title,
      description: source.description,
      location: source.location,
      startsAt: source.startsAt,
      endsAt: source.endsAt,
      isPublic: source.isPublic,
    },
    select: eventSelection,
    take: 2,
  });

  return candidates.length === 1 ? candidates[0] : null;
}
