import { getAdminMembership, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { readSuperAdminSessionFromServerCookies } from "@/lib/superadmin-auth";
import { requireVillagePermission, type VillagePermission } from "@/lib/village-permissions";

/** The support workspace is an environment actor, never a village membership. */
export const SUPERADMIN_IMPORT_ACTOR_ID = "SUPERADMIN_ENV";

export type PopulationImportWorkspaceAccess = {
  actorType: "ADMIN" | "SUPERADMIN_ENV";
  actorRole: string;
  actorId: string;
  userId: string | null;
  villageId: string;
};

export async function requirePopulationImportWorkspaceAccess(
  requestedVillageId = "",
  permission: VillagePermission = "population.import",
): Promise<PopulationImportWorkspaceAccess> {
  const superAdminSession = await readSuperAdminSessionFromServerCookies();
  if (superAdminSession) {
    if (!requestedVillageId) throw new Error("ต้องระบุหมู่บ้านเป้าหมายสำหรับการดำเนินการของผู้ดูแลระบบระดับสูง");

    const village = await prisma.village.findUnique({ where: { id: requestedVillageId }, select: { id: true } });
    if (!village) throw new Error("ไม่พบข้อมูลหมู่บ้าน");

    return { actorType: "SUPERADMIN_ENV", actorRole: "SUPERADMIN", actorId: SUPERADMIN_IMPORT_ACTOR_ID, userId: null, villageId: village.id };
  }

  const session = await getSessionContextFromServerCookies();
  if (!session?.id || !isAdminUser(session)) throw new Error("ไม่มีสิทธิ์ใช้งาน");

  const membership = getAdminMembership(session);
  if (!membership) throw new Error("ไม่พบหมู่บ้านที่คุณมีสิทธิ์จัดการ");
  requireVillagePermission(membership, permission);

  return { actorType: "ADMIN", actorRole: membership.role, actorId: session.id, userId: session.id, villageId: membership.villageId };
}
