/**
 * Compatibility-only labels for actor-role strings persisted in immutable
 * audit, notification, issue, and appointment metadata. These are not Prisma
 * enum values and must never be used to authorize a current user.
 */
export type LegacyActorRole =
  | "HEADMAN"
  | "ASSISTANT_HEADMAN"
  | "RESIDENT"
  | "SUPERADMIN"
  | "SUPERADMIN_ENV"
  | "ADMIN"
  | "USER";

const LEGACY_ACTOR_ROLE_LABELS: Record<LegacyActorRole, string> = {
  HEADMAN: "ผู้ใหญ่บ้าน",
  ASSISTANT_HEADMAN: "ผู้ช่วยผู้ใหญ่บ้าน",
  RESIDENT: "ลูกบ้าน",
  SUPERADMIN: "ผู้ดูแลระบบระดับสูง",
  SUPERADMIN_ENV: "ผู้ดูแลระบบระดับสูง",
  ADMIN: "ผู้ดูแลระบบระดับสูง",
  USER: "ผู้ใช้งาน",
};

export function getLegacyActorRoleLabel(role?: string | null): string | null {
  return LEGACY_ACTOR_ROLE_LABELS[role as LegacyActorRole] ?? null;
}
