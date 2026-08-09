import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

let linked = 0;
let ambiguous = 0;
let missing = 0;

try {
  const submissions = await prisma.villageEventSubmission.findMany({
    where: { type: "CREATE", status: "APPROVED", eventId: null },
    select: { id: true, villageId: true, title: true, description: true, location: true, startsAt: true, endsAt: true, isPublic: true },
  });

  for (const submission of submissions) {
    const candidates = await prisma.villageEvent.findMany({
      where: {
        villageId: submission.villageId,
        title: submission.title,
        description: submission.description,
        location: submission.location,
        startsAt: submission.startsAt,
        endsAt: submission.endsAt,
        isPublic: submission.isPublic,
      },
      select: { id: true },
      take: 2,
    });

    if (candidates.length !== 1) {
      if (candidates.length === 0) missing += 1;
      else ambiguous += 1;
      continue;
    }

    await prisma.villageEventSubmission.update({ where: { id: submission.id }, data: { eventId: candidates[0].id } });
    linked += 1;
  }

  console.log(JSON.stringify({ scanned: submissions.length, linked, ambiguous, missing }));
} finally {
  await prisma.$disconnect();
}
