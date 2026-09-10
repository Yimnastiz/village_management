import { getLegacyActorRoleLabel } from "@/lib/legacy-actor-role";

export type UserDisplaySource = {
  name?: string | null;
  legacyRole?: string | null;
  memberships?: Array<{ role?: string | null }>;
};

export function getThaiRoleLabel(role?: string | null): string {
  return getLegacyActorRoleLabel(role) ?? "ผู้ใช้งาน";
}

export function getUserDisplayName(user?: UserDisplaySource | null): string {
  return user?.name?.trim() || "ไม่พบข้อมูลผู้ใช้งาน";
}

export function getUserRoleLabel(user?: UserDisplaySource | null): string {
  return getThaiRoleLabel(user?.memberships?.[0]?.role ?? user?.legacyRole);
}
