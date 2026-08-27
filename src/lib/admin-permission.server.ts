import { redirect } from "next/navigation";
import { getAdminMembership, getSessionContextFromServerCookies, type SessionContext } from "@/lib/access-control";
import { hasVillagePermission, type VillagePermission } from "@/lib/village-permissions";

export type VillagePermissionContext = {
  session: SessionContext;
  membership: NonNullable<ReturnType<typeof getAdminMembership>>;
  villageId: string;
};

/** Shared authenticated context for all village-admin pages and server actions. */
export async function getVillagePermissionContext(
  permission: VillagePermission,
  options: { villageId?: string | null } = {},
): Promise<VillagePermissionContext | null> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return null;
  const membership = getAdminMembership(session, { villageId: options.villageId });
  if (!membership || !hasVillagePermission(membership.role, permission)) return null;
  return { session, membership, villageId: membership.villageId };
}

export async function requireVillageActionPermission(
  permission: VillagePermission,
  options: { villageId?: string | null } = {},
): Promise<VillagePermissionContext> {
  const context = await getVillagePermissionContext(permission, options);
  if (!context) throw new Error(`Forbidden: ${permission}`);
  return context;
}

export async function requireVillagePagePermission(
  permission: VillagePermission,
  options: { callbackUrl?: string; forbiddenRedirect?: string } = {},
): Promise<VillagePermissionContext> {
  const session = await getSessionContextFromServerCookies();
  if (!session) redirect(`/auth/login?callbackUrl=${encodeURIComponent(options.callbackUrl ?? "/admin")}`);
  const membership = getAdminMembership(session);
  if (!membership || !hasVillagePermission(membership.role, permission)) redirect(options.forbiddenRedirect ?? "/admin/dashboard");
  return { session, membership, villageId: membership.villageId };
}
