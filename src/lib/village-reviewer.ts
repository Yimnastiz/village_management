import { MEMBERSHIP_ROLE_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

/** Resolves an administrative reviewer without ever exposing its internal user id. */
export async function getVillageReviewerDisplay(userId: string | null, villageId: string) {
  if (!userId) return null;
  const reviewer = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      memberships: {
        where: { villageId, status: "ACTIVE" },
        select: { role: true, status: true },
        take: 1,
      },
    },
  });
  const name = reviewer?.name?.trim() || "ผู้ดูแลหมู่บ้าน";
  const role = reviewer?.memberships[0]?.role;
  return { name, role, label: role && role !== "RESIDENT" ? `${name} (${MEMBERSHIP_ROLE_LABELS[role] ?? role})` : name };
}
