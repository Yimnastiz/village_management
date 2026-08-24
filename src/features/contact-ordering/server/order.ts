import type { Prisma } from "@prisma/client";

/** Appends newly created directory entries after the current curated list. */
export async function getNextContactSortOrder(tx: Prisma.TransactionClient, villageId: string) {
  const current = await tx.contactDirectory.aggregate({
    where: { villageId },
    _max: { sortOrder: true },
  });
  return (current._max.sortOrder ?? -1) + 1;
}
