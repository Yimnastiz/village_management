import "server-only";

import { NewsSubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** The single village-scoped source for the actionable News request queue. */
export function getPendingNewsSubmissionCount(villageId: string) {
  return prisma.newsSubmission.count({ where: { villageId, status: NewsSubmissionStatus.PENDING } });
}
