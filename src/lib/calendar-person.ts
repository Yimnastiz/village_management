type CalendarPerson = {
  name?: string | null;
  memberships?: Array<{ role?: string | null }>;
};

const membershipRoleLabels: Record<string, string> = {
  HEADMAN: "ผู้ใหญ่บ้าน",
  RESIDENT: "ลูกบ้าน",
};

export function formatCalendarPerson(
  person?: CalendarPerson | null,
  fallback = "ไม่พบข้อมูลผู้สร้าง"
) {
  const name = person?.name?.trim();
  if (!name) return fallback;

  const membershipRole = person?.memberships?.[0]?.role ?? null;
  const role = membershipRole;
  const position = role ? membershipRoleLabels[role] : undefined;

  return position ? `${name} (${position})` : name;
}
