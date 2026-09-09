import { getAdminMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { hasVillagePermission, type VillagePermission } from "@/lib/village-permissions";

export type VillageActorContext = {
  actorUserId: string;
  actorRole: "HEADMAN";
  villageId: string;
  villageSlug?: string;
};

export async function requireAdminVillageContext(permission: VillagePermission = "dashboard.view"): Promise<
  { ok: true; context: VillageActorContext } | { ok: false; error: string }
> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };

  const membership = getAdminMembership(session);
  if (!membership) return { ok: false, error: "ไม่พบหมู่บ้านที่คุณดูแล" };
  if (!hasVillagePermission(membership.role, permission)) return { ok: false, error: "ไม่มีสิทธิ์ดำเนินการ" };

  return {
    ok: true,
    context: {
      actorUserId: session.id,
      actorRole: "HEADMAN",
      villageId: membership.villageId,
      villageSlug: membership.villageSlug ?? undefined,
    },
  };
}
