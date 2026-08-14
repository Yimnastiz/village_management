import { MEMBERSHIP_ROLE_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export type VillageReviewerDisplay = {
  name: string;
  role?: string;
  label: string;
};

function toVillageReviewerDisplay(reviewer?: {
  name: string | null;
  memberships: Array<{ role: string }>;
}): VillageReviewerDisplay {
  const name = reviewer?.name?.trim() || "ผู้ดูแลหมู่บ้าน";
  const role = reviewer?.memberships[0]?.role;
  return {
    name,
    role,
    label: role && role !== "RESIDENT" ? `${name} (${MEMBERSHIP_ROLE_LABELS[role] ?? role})` : name,
  };
}

/** Resolves reviewers in one query, including a safe fallback for deleted users. */
export async function getVillageReviewerDisplayMap(userIds: Iterable<string>, villageId: string) {
  const ids = [...new Set([...userIds].filter(Boolean))];
  const reviewerMap = new Map<string, VillageReviewerDisplay>();
  if (!ids.length) return reviewerMap;

  const reviewers = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      memberships: {
        where: { villageId, status: "ACTIVE" },
        select: { role: true },
        take: 1,
      },
    },
  });

  const reviewersById = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer]));
  for (const id of ids) reviewerMap.set(id, toVillageReviewerDisplay(reviewersById.get(id)));
  return reviewerMap;
}

/** Resolves an administrative reviewer without ever exposing its internal user id. */
export async function getVillageReviewerDisplay(userId: string | null, villageId: string) {
  if (!userId) return null;
  return (await getVillageReviewerDisplayMap([userId], villageId)).get(userId) ?? null;
}
