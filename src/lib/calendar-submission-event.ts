import { prisma } from "@/lib/prisma";

type ApprovedSubmissionSource = {
  eventId: string | null;
  villageId: string;
};

const eventSelection = {
  id: true,
  createdById: true,
  title: true,
  description: true,
  location: true,
  startsAt: true,
  endsAt: true,
  isPublic: true,
} as const;

/** Resolve the published event through the submission's explicit event link. */
export async function resolveApprovedSubmissionEvent(source: ApprovedSubmissionSource) {
  if (!source.eventId) return null;
  return prisma.villageEvent.findFirst({
    where: { id: source.eventId, villageId: source.villageId },
    select: eventSelection,
  });
}
