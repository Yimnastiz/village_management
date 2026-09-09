import "server-only";

import { MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DUPLICATE_ACCOUNT = {
  OR: [
    { accountStatus: "DUPLICATE_ID" as const },
    { duplicateOfUserId: { not: null }, duplicateResolvedAt: null },
  ],
};

/** A duplicate is relevant only when it has a current operational association
 * with this Village. Suspended memberships remain reviewable; pending/rejected
 * rows do not. All filters execute in the database. */
export async function getVillageDataQuality(villageId: string) {
  const duplicateWhere = {
    ...DUPLICATE_ACCOUNT,
    memberships: { some: { villageId, status: { in: [MembershipStatus.ACTIVE, MembershipStatus.SUSPENDED] } } },
  };
  const residentWithoutHouseWhere = { villageId, role: VillageMembershipRole.RESIDENT, status: MembershipStatus.ACTIVE, houseId: null };
  const [duplicateCount, duplicates, residentWithoutHouseCount, residentsWithoutHouse] = await Promise.all([
    prisma.user.count({ where: duplicateWhere }),
    prisma.user.findMany({ where: duplicateWhere, orderBy: { updatedAt: "desc" }, take: 8, select: { id: true, name: true, accountStatus: true } }),
    prisma.villageMembership.count({ where: residentWithoutHouseWhere }),
    prisma.villageMembership.findMany({ where: residentWithoutHouseWhere, orderBy: { updatedAt: "desc" }, take: 8, select: { id: true, user: { select: { name: true } } } }),
  ]);
  return { duplicateCount, duplicates, residentWithoutHouseCount, residentsWithoutHouse, issueCount: duplicateCount + residentWithoutHouseCount };
}
