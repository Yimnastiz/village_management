export type UserDisplaySource = {
  name?: string | null;
  systemRole?: string | null;
  memberships?: Array<{ role?: string | null }>;
};

export function getThaiRoleLabel(role?: string | null): string {
  switch (role) {
    case "HEADMAN": return "ผู้ใหญ่บ้าน";
    case "ASSISTANT_HEADMAN": return "ผู้ช่วยผู้ใหญ่บ้าน";
    case "SUPERADMIN": return "ผู้ดูแลระบบสูงสุด";
    case "RESIDENT":
    case "USER": return "ลูกบ้าน";
    default: return "ผู้ใช้งาน";
  }
}

export function getUserDisplayName(user?: UserDisplaySource | null): string {
  return user?.name?.trim() || "ไม่พบข้อมูลผู้ใช้งาน";
}

export function getUserRoleLabel(user?: UserDisplaySource | null): string {
  return getThaiRoleLabel(user?.memberships?.[0]?.role ?? user?.systemRole);
}
