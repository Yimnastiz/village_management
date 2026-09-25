const ACTOR_ROLE_LABELS: Record<string, string> = {
  HEADMAN: "ผู้ใหญ่บ้าน",
  RESIDENT: "สมาชิก",
};

export function getActorRoleLabel(role?: string | null): string | null {
  return role ? ACTOR_ROLE_LABELS[role] ?? null : null;
}
