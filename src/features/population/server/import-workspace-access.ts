import { getAdminMembership, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { requireVillagePermission, type VillagePermission } from "@/lib/village-permissions";

export type PopulationImportWorkspaceAccess = {
  actorType: "ADMIN";
  actorRole: string;
  actorId: string;
  userId: string;
  villageId: string;
};

/** Resolves the authenticated Headman's village-scoped import authority. */
export async function requirePopulationImportWorkspaceAccess(
  _requestedVillageId = "",
  permission: VillagePermission = "population.import",
): Promise<PopulationImportWorkspaceAccess> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id || !isAdminUser(session)) throw new Error("ไม่มีสิทธิ์ใช้งาน");

  const membership = getAdminMembership(session);
  if (!membership) throw new Error("ไม่พบหมู่บ้านที่คุณมีสิทธิ์จัดการ");
  requireVillagePermission(membership, permission);

  return { actorType: "ADMIN", actorRole: membership.role, actorId: session.id, userId: session.id, villageId: membership.villageId };
}
