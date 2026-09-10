import type { VillageMembershipRole } from "@prisma/client";

const membershipLabels: Partial<Record<VillageMembershipRole, string>> = {
  HEADMAN: "ผู้ใหญ่บ้าน",
  RESIDENT: "ลูกบ้าน",
};

export function formatNewsAuthor(name?: string | null, membershipRole?: VillageMembershipRole | null) {
  const displayName = name?.trim() || "ไม่ทราบชื่อผู้สร้าง";
  const position = membershipRole ? membershipLabels[membershipRole] : undefined;
  return position ? `${displayName} (${position})` : displayName;
}
