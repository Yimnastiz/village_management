import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MEMBERSHIP_ROLE_LABELS } from "@/lib/constants";
import { formatThaiDateTime } from "@/lib/utils";
import { AppointmentTimeline } from "@/components/appointments/appointment-timeline";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { redirect } from "next/navigation";
import { AppointmentActions } from "./appointment-actions";

interface PageProps { params: Promise<{ appointmentId: string }>; searchParams?: Promise<{ from?: string; month?: string; date?: string }> }

const stageVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = { PENDING_APPROVAL: "warning", TIME_SUGGESTED: "info", APPROVED: "success", REJECTED: "danger", CANCELLED: "default", COMPLETED: "info" };
const residentStageLabels: Record<string, string> = { PENDING_APPROVAL: "รอผู้ใหญ่บ้านตอบกลับ", TIME_SUGGESTED: "รอคุณยืนยันเวลา", APPROVED: "ยืนยันนัดหมายแล้ว", REJECTED: "ปฏิเสธ", CANCELLED: "ยกเลิก", COMPLETED: "เสร็จสิ้น" };
function metadataOf(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function stringValue(metadata: Record<string, unknown>, key: string) { const value = metadata[key]; return typeof value === "string" && value.trim() ? value.trim() : null; }
function roleLabel(role: string | null | undefined) { return role ? MEMBERSHIP_ROLE_LABELS[role] ?? "ผู้ดูแลหมู่บ้าน" : "ผู้ดูแลหมู่บ้าน"; }
function appointmentDateTime(appointment: { scheduledAt: Date | null; slot: { date: Date; startTime: string } | null }) {
  if (!appointment.scheduledAt || !appointment.slot) return null;
  const [hours, minutes] = appointment.slot.startTime.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  return new Date(Date.UTC(appointment.slot.date.getUTCFullYear(), appointment.slot.date.getUTCMonth(), appointment.slot.date.getUTCDate(), hours, minutes) - 7 * 60 * 60 * 1000);
}

export default async function AppointmentDetailPage({ params, searchParams }: PageProps) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  const membership = getResidentMembership(session);
  if (!membership) redirect("/resident/dashboard");
  const { appointmentId } = await params;
  const query = searchParams ? await searchParams : {};
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, userId: session.id },
    include: { slot: true, timeline: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true, memberships: { where: { villageId: membership.villageId, status: "ACTIVE" }, select: { role: true }, take: 1 } } } } } },
  });
  if (!appointment) redirect("/resident/appointments");

  const firstEntry = appointment.timeline[0];
  const firstMetadata = metadataOf(firstEntry?.metadata ?? null);
  const adminCreated = firstMetadata.adminCreated === true;
  const creatorName = stringValue(firstMetadata, "creatorName") ?? firstEntry?.actor?.name ?? null;
  const creatorRole = stringValue(firstMetadata, "creatorRole") ?? firstEntry?.actor?.memberships[0]?.role ?? null;
  const targetName = stringValue(firstMetadata, "targetAdminName");
  const targetRole = stringValue(firstMetadata, "targetAdminRole");
  const targetUserId = stringValue(firstMetadata, "targetAdminUserId") ?? "";
  const preferredTime = appointment.timeline.map((entry) => stringValue(metadataOf(entry.metadata), "preferredTime")).filter((value): value is string => Boolean(value)).at(-1) ?? "";
  const source = adminCreated ? (creatorName ? `สร้างโดย ${creatorName} (${roleLabel(creatorRole)})` : "สร้างโดยผู้ดูแลหมู่บ้าน") : (targetName ? `ส่งคำขอถึง ${targetName} (${roleLabel(targetRole)})` : "คุณส่งคำขอนัดหมาย");
  const withPerson = adminCreated ? (creatorName ? `${creatorName} (${roleLabel(creatorRole)})` : "ผู้ดูแลหมู่บ้าน") : (targetName ? `${targetName} (${roleLabel(targetRole)})` : "ผู้ดูแลหมู่บ้าน");
  const scheduledAt = appointmentDateTime(appointment);
  const displayDescription = appointment.description?.split("\n").filter((line) => !line.startsWith("ช่วงเวลาที่สะดวก:")).join("\n").trim() || "";
  const editable = !adminCreated && appointment.stage === "PENDING_APPROVAL" && !appointment.timeline.some((entry) => entry.action === "TIME_SUGGESTED");
  const validCalendarReturn = query.from === "calendar" && /^\d{4}-\d{2}$/.test(query.month ?? "") && /^\d{4}-\d{2}-\d{2}$/.test(query.date ?? "") && query.date?.startsWith(`${query.month}-`);
  const backHref = validCalendarReturn ? `/resident/calendar?month=${query.month}&date=${query.date}` : "/resident/appointments";

  return <div className="mx-auto max-w-3xl space-y-4 sm:space-y-5">
    <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800"><ArrowLeft className="h-4 w-4" />กลับไปรายการนัดหมาย</Link>
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <header className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="min-w-0 text-xl font-bold text-gray-900 sm:text-2xl">{appointment.title}</h1>
        <Badge className="self-start" variant={stageVariant[appointment.stage] ?? "default"}>{residentStageLabels[appointment.stage] ?? appointment.stage}</Badge>
      </header>
      <div className="divide-y divide-gray-100 text-sm">
        <section className="grid gap-3 py-4 sm:grid-cols-2">
          <div><p className="text-gray-500">ที่มา</p><p className="mt-1 font-medium text-gray-800">{source}</p></div>
          <div><p className="text-gray-500">นัดหมายกับ</p><p className="mt-1 font-medium text-gray-800">{withPerson}</p></div>
        </section>
        {scheduledAt ? <section className="py-4"><p className="flex items-start gap-2 font-medium text-gray-800"><Clock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" /><span>{["APPROVED", "COMPLETED"].includes(appointment.stage) ? "นัดหมาย" : "เสนอเวลา"}: {formatThaiDateTime(scheduledAt)}</span></p></section> : null}
        {preferredTime ? <section className="py-4"><p className="text-gray-500">ช่วงเวลาที่สะดวก</p><p className="mt-1 whitespace-pre-wrap text-gray-800">{preferredTime}</p></section> : null}
        {displayDescription ? <section className="py-4"><p className="text-gray-500">รายละเอียด</p><p className="mt-1 whitespace-pre-wrap leading-6 text-gray-800">{displayDescription}</p></section> : null}
        <section className="py-4"><p className="text-gray-500">ส่งเมื่อ</p><p className="mt-1 text-gray-800">{formatThaiDateTime(appointment.createdAt)}</p></section>
      </div>
      <div className="border-t border-gray-100 pt-4"><AppointmentActions appointmentId={appointment.id} stage={appointment.stage} editable={editable} title={appointment.title} description={displayDescription} preferredTime={preferredTime} targetAdminUserId={targetUserId} /></div>
    </article>
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
      <h2 className="font-semibold text-gray-900">ประวัติการดำเนินการ</h2>
      <AppointmentTimeline entries={appointment.timeline} villageId={membership.villageId} viewerId={session.id} />
    </section>
  </div>;
}
