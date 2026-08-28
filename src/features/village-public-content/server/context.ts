import { notFound } from "next/navigation";
import { getAdminMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminActionSession } from "@/lib/superadmin";
import { hasVillagePermission, type VillagePermission } from "@/lib/village-permissions";

export type VillageActorContext = {
  actorUserId: string | null;
  actorRole: "HEADMAN" | "ASSISTANT_HEADMAN" | "SUPERADMIN";
  villageId: string;
  villageName?: string;
  villageSlug?: string;
  supportReason?: string;
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
      actorRole: membership.role as "HEADMAN" | "ASSISTANT_HEADMAN",
      villageId: membership.villageId,
      villageSlug: membership.villageSlug ?? undefined,
    },
  };
}

export async function requireSuperAdminVillageContext(villageId: string): Promise<VillageActorContext> {
  await requireSuperAdminActionSession();

  const village = await prisma.village.findUnique({
    where: { id: villageId },
    select: { id: true, name: true, slug: true },
  });

  if (!village) notFound();

  return {
    actorUserId: null,
    actorRole: "SUPERADMIN",
    villageId: village.id,
    villageName: village.name,
    villageSlug: village.slug,
  };
}

export function requireSupportReason(reason: string | null | undefined): string {
  const value = (reason ?? "").trim();
  if (value.length < 5) {
    throw new Error("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร");
  }
  if (value.length > 500) {
    throw new Error("เหตุผลต้องไม่เกิน 500 ตัวอักษร");
  }
  return value;
}
