import type { SystemRole, VillageMembershipRole } from "@prisma/client";

const membershipLabels: Partial<Record<VillageMembershipRole, string>> = {
  HEADMAN: "ผู้ใหญ่บ้าน",
  ASSISTANT_HEADMAN: "ผู้ช่วยผู้ใหญ่บ้าน",
  COMMITTEE: "คณะกรรมการหมู่บ้าน",
};

export function formatNewsAuthor(name?: string | null, systemRole?: SystemRole | null, membershipRole?: VillageMembershipRole | null) {
  const displayName = name?.trim() || "ไม่ทราบชื่อผู้สร้าง";
  const position = systemRole === "SUPERADMIN" ? "ผู้ดูแลระบบ" : membershipRole ? membershipLabels[membershipRole] : undefined;
  return position ? `${displayName} (${position})` : displayName;
}
