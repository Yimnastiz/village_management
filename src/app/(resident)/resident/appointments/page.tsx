import { Prisma, type VillageMembershipRole } from "@prisma/client";
import { MEMBERSHIP_ROLE_LABELS } from "@/lib/constants";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ResidentAppointmentCard } from "./resident-appointment-card";
import { ResidentAppointmentsToolbar } from "./resident-appointments-toolbar";

interface PageProps { searchParams: Promise<{ q?: string; status?: string; period?: string; sort?: string }> }

const stageVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING_APPROVAL: "warning", TIME_SUGGESTED: "info", APPROVED: "success", REJECTED: "danger", CANCELLED: "default", COMPLETED: "info",
};

const residentStageLabels: Record<string, string> = {
  PENDING_APPROVAL: "รอผู้ใหญ่บ้านตอบกลับ",
  TIME_SUGGESTED: "รอคุณยืนยันเวลา",
  APPROVED: "ยืนยันนัดหมายแล้ว",
  REJECTED: "ปฏิเสธ",
  CANCELLED: "ยกเลิก",
  COMPLETED: "เสร็จสิ้น",
};

function metadataOf(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, Prisma.JsonValue> : {};
}

function stringValue(metadata: Record<string, Prisma.JsonValue>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function appointmentDateTime(appointment: { scheduledAt: Date | null; slot: { date: Date; startTime: string } | null }) {
  if (!appointment.scheduledAt || !appointment.slot) return null;
  const [hours, minutes] = appointment.slot.startTime.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  return new Date(Date.UTC(appointment.slot.date.getUTCFullYear(), appointment.slot.date.getUTCMonth(), appointment.slot.date.getUTCDate(), hours, minutes) - 7 * 60 * 60 * 1000);
}

function appointmentSource(appointment: { timeline: Array<{ metadata: Prisma.JsonValue | null; actor: { name: string; memberships: Array<{ role: VillageMembershipRole }> } | null }> }) {
  const entry = appointment.timeline[0];
  const metadata = metadataOf(entry?.metadata ?? null);
  const actorName = entry?.actor?.name ?? null;
  const actorRole = entry?.actor?.memberships[0]?.role;
  if (metadata.adminCreated === true) {
    const name = stringValue(metadata, "creatorName") ?? actorName;
    const role = stringValue(metadata, "creatorRole") ?? actorRole;
    return name ? `สร้างโดย ${name} (${MEMBERSHIP_ROLE_LABELS[role ?? ""] ?? "ผู้ดูแลหมู่บ้าน"})` : "สร้างโดยผู้ดูแลหมู่บ้าน";
  }
  const targetName = stringValue(metadata, "targetAdminName");
  const targetRole = stringValue(metadata, "targetAdminRole");
  return targetName ? `ส่งคำขอถึง ${targetName} (${MEMBERSHIP_ROLE_LABELS[targetRole ?? ""] ?? "ผู้ดูแลหมู่บ้าน"})` : "คุณส่งคำขอนัดหมาย";
}

export default async function AppointmentsPage({ searchParams }: PageProps) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  const membership = getResidentMembership(session);
  if (!membership) redirect("/resident/dashboard");

  const query = await searchParams;
  const keyword = query.q?.trim() ?? "";
  const validStatuses = ["PENDING_APPROVAL", "TIME_SUGGESTED", "APPROVED", "REJECTED", "CANCELLED", "COMPLETED"] as const;
  const statuses = Array.from(new Set((query.status ?? "").split(",").filter((value): value is typeof validStatuses[number] => validStatuses.includes(value as typeof validStatuses[number]))));
  const period = query.period === "upcoming" || query.period === "past" ? query.period : "all";
  const sort = query.sort === "oldest" ? "oldest" : "newest";
  const allAppointments = await prisma.appointment.findMany({
    where: { userId: session.id, ...(statuses.length ? { stage: { in: statuses } } : {}), ...(keyword ? { OR: [{ title: { contains: keyword, mode: "insensitive" as const } }, { description: { contains: keyword, mode: "insensitive" as const } }] } : {}) },
    include: { slot: true, timeline: { orderBy: { createdAt: "asc" }, take: 1, select: { metadata: true, actor: { select: { name: true, memberships: { where: { villageId: membership.villageId, status: "ACTIVE" }, select: { role: true }, take: 1 } } } } } },
    orderBy: { createdAt: sort === "oldest" ? "asc" : "desc" },
  });
  const now = new Date();
  const filteredAppointments = allAppointments.filter((appointment) => {
    if (period === "all") return true;
    const dateTime = appointmentDateTime(appointment);
    if (!dateTime) return false;
    return period === "upcoming" ? dateTime >= now : dateTime < now;
  });
  const suggestionTitles = Array.from(new Set(allAppointments.map((appointment) => appointment.title))).slice(0, 20);

  return <div className="space-y-5">
    <ResidentAppointmentsToolbar keyword={keyword} statuses={statuses} period={period} sort={sort} suggestions={suggestionTitles} />
    <section>
      <h2 className="mb-3 text-lg font-semibold text-gray-800">รายการนัดหมายของคุณ</h2>
      {filteredAppointments.length === 0 ? <div className="rounded-xl border border-gray-200 bg-white p-8 text-center"><p className="text-gray-500">ยังไม่มีนัดหมายในรายการนี้</p></div> : <div className="space-y-3">{filteredAppointments.map((appointment) => {
        const scheduledAt = appointmentDateTime(appointment);
        const preferredTime = stringValue(metadataOf(appointment.timeline[0]?.metadata ?? null), "preferredTime");
        return <ResidentAppointmentCard key={appointment.id} id={appointment.id} title={appointment.title} stageLabel={residentStageLabels[appointment.stage] ?? appointment.stage} stageVariant={stageVariant[appointment.stage] ?? "default"} source={appointmentSource(appointment)} scheduledAt={scheduledAt} isConfirmed={["APPROVED", "COMPLETED"].includes(appointment.stage)} preferredTime={preferredTime} createdAt={appointment.createdAt} />;
      })}</div>}
    </section>
  </div>;
}
