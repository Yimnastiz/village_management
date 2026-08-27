type CalendarPerson = {
  name?: string | null;
  systemRole?: string | null;
  memberships?: Array<{ role?: string | null }>;
};

const privilegedRoleLabels: Record<string, string> = {
  HEADMAN: "ผู้ใหญ่บ้าน",
  ASSISTANT_HEADMAN: "ผู้ช่วยผู้ใหญ่บ้าน",
  DEPUTY_HEADMAN: "ผู้ช่วยผู้ใหญ่บ้าน",
  ADMIN: "เจ้าหน้าที่",
  STAFF: "เจ้าหน้าที่",
  SUPERADMIN: "ผู้ดูแลระบบสูงสุด",
};

export function formatCalendarPerson(
  person?: CalendarPerson | null,
  fallback = "ไม่พบข้อมูลผู้สร้าง"
) {
  const name = person?.name?.trim();
  if (!name) return fallback;

  const membershipRole = person?.memberships?.[0]?.role ?? null;
  const role = membershipRole && membershipRole !== "RESIDENT" ? membershipRole : person?.systemRole;
  const position = role ? privilegedRoleLabels[role] : undefined;

  return position ? `${name} (${position})` : name;
}
