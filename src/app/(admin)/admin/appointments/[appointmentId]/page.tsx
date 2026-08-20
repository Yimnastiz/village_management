import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma, VillageMembershipRole } from "@prisma/client";
import { Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { Badge } from "@/components/ui/badge";
import { APPOINTMENT_STAGE_LABELS } from "@/lib/constants";
import { formatThaiDate, formatThaiDateTime } from "@/lib/utils";
import { ProposeTimeForm } from "./propose-time-form";
import { AppointmentStatusActions } from "./appointment-status-actions";
import { AppointmentTimeline } from "@/components/appointments/appointment-timeline";

const ROLE_LABELS: Partial<Record<VillageMembershipRole, string>> = { HEADMAN: "ผู้ใหญ่บ้าน", ASSISTANT_HEADMAN: "ผู้ช่วยผู้ใหญ่บ้าน", COMMITTEE: "คณะกรรมการหมู่บ้าน", RESIDENT: "ลูกบ้าน" };

function getAppointmentSource(timeline: Array<{ action: string; actorId: string | null; metadata: Prisma.JsonValue | null; actor: { name: string | null; email: string | null; memberships: Array<{ role: VillageMembershipRole }> } | null }>) {
  const entry = timeline[0]; const actor = entry?.actor;
  if (!entry || !actor) return { label: null, isAdminCreated: false, creatorId: null };
  const metadata = entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata) ? entry.metadata : null;
  const name = typeof metadata?.creatorName === "string" ? metadata.creatorName : actor.name || actor.email;
  if (!name) return { label: null, isAdminCreated: metadata?.adminCreated === true, creatorId: entry.actorId };
  const role = typeof metadata?.creatorRole === "string" ? metadata.creatorRole : actor.memberships[0]?.role;
  if (metadata?.adminCreated === true) return { label: `สร้างโดย ${name} (${ROLE_LABELS[role as VillageMembershipRole] ?? "เจ้าหน้าที่"})`, isAdminCreated: true, creatorId: entry.actorId };
  if (entry.action === "CREATED") return { label: `ส่งคำขอโดย ${name} (${ROLE_LABELS[role as VillageMembershipRole] ?? "ลูกบ้าน"})`, isAdminCreated: false, creatorId: null };
  return { label: null, isAdminCreated: false, creatorId: null };
}

function splitAppointmentDescription(description: string | null) {
  if (!description) return { description: null, preferredTime: null };
  const lines = description.split(/\r?\n/);
  const preferredTimeIndex = lines.findIndex((line) => line.trim().startsWith("ช่วงเวลาที่สะดวก:"));
  if (preferredTimeIndex < 0) return { description, preferredTime: null };
  const preferredTime = lines[preferredTimeIndex].replace(/^\s*ช่วงเวลาที่สะดวก:\s*/, "").trim() || null;
  return { description: lines.filter((_, index) => index !== preferredTimeIndex).join("\n").trim() || null, preferredTime };
}

function metadataOf(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, Prisma.JsonValue> : {};
}

function stringValue(metadata: Record<string, Prisma.JsonValue>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export default async function AdminAppointmentDetailPage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const session = await getSessionContextFromServerCookies(); if (!session?.id || !isAdminUser(session)) redirect("/auth/login");
  const { appointmentId } = await params;
  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, village: { memberships: { some: { userId: session.id, status: "ACTIVE", role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] } } } } }, include: { user: { select: { name: true, email: true, phoneNumber: true } }, slot: true, timeline: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true, email: true, memberships: { where: { status: "ACTIVE" }, select: { villageId: true, role: true } } } } } } } });
  if (!appointment) redirect("/admin/appointments");
  const stageLabel = appointment.stage === "TIME_SUGGESTED" ? "รอลูกบ้านยืนยันเวลา" : APPOINTMENT_STAGE_LABELS[appointment.stage];
  const isConfirmed = ["APPROVED", "COMPLETED"].includes(appointment.stage);
  const source = getAppointmentSource(appointment.timeline);
  const canProposeTime = !source.isAdminCreated && appointment.stage === "PENDING_APPROVAL";
  const canEditAdminCreated = source.isAdminCreated && source.creatorId === session.id && appointment.stage === "TIME_SUGGESTED";
  const canReject = !source.isAdminCreated && appointment.stage === "PENDING_APPROVAL";
  const canCancel = ["TIME_SUGGESTED", "APPROVED"].includes(appointment.stage);
  const initialDate = appointment.slot?.date.toISOString().slice(0, 10) ?? "";
  const initialStartTime = appointment.slot?.startTime ?? "";
  const appointmentContent = splitAppointmentDescription(appointment.description);
  const cancellationEntry = appointment.stage === "CANCELLED" ? appointment.timeline.filter((entry) => entry.action === "CANCELLED").at(-1) : null;
  const cancellationMetadata = metadataOf(cancellationEntry?.metadata ?? null);
  const cancellationReason = stringValue(cancellationMetadata, "reason");
  const cancellationMembership = cancellationEntry?.actor?.memberships.find((item) => item.villageId === appointment.villageId);
  const cancellationActorName = cancellationEntry?.actor?.name || cancellationEntry?.actor?.email || null;
  const cancellationActor = cancellationActorName ? `${cancellationActorName}${cancellationMembership ? ` (${ROLE_LABELS[cancellationMembership.role] ?? "ผู้ดำเนินการ"})` : ""}` : null;
  return <div className="mx-auto max-w-3xl space-y-5">
    <Link href="/admin/appointments" className="text-sm text-gray-500 hover:text-gray-800">← กลับไปรายการนัดหมาย</Link>
    <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0"><h1 className="break-words text-xl font-bold text-gray-900">{appointment.title}</h1>{appointmentContent.description ? <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-gray-600">{appointmentContent.description}</p> : null}</div>
        <Badge className="shrink-0" variant={appointment.stage === "APPROVED" ? "success" : appointment.stage === "TIME_SUGGESTED" ? "info" : appointment.stage === "REJECTED" ? "danger" : "warning"}>{stageLabel}</Badge>
      </div>
      <div className="mt-5 grid gap-x-8 gap-y-4 border-t border-gray-200 pt-4 text-sm sm:grid-cols-2">
        <div><p className="text-xs text-gray-500">นัดหมายกับ</p><p className="mt-1 text-gray-900">{appointment.user.name || appointment.user.email}</p></div>
        <div><p className="text-xs text-gray-500">เบอร์ติดต่อ</p><p className="mt-1 text-gray-900">{appointment.user.phoneNumber || "-"}</p></div>
      </div>
      {appointment.slot || appointmentContent.preferredTime ? <div className="mt-4 border-t border-gray-200 pt-4 text-sm"><div className="space-y-4">{appointment.slot ? <div className="flex items-start gap-2"><Clock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" /><p className="text-gray-900">{isConfirmed ? "นัดหมาย" : "เสนอเวลา"}: {formatThaiDate(appointment.slot.date)} เวลา {appointment.slot.startTime}</p></div> : null}{appointmentContent.preferredTime ? <div><p className="text-xs text-gray-500">ช่วงเวลาที่สะดวก</p><p className="mt-1 text-gray-700">{appointmentContent.preferredTime}</p></div> : null}</div></div> : null}
      <div className="mt-4 border-t border-gray-200 pt-4"><div className="space-y-3"><p className="text-xs text-gray-500">{source.label ?? "คำขอนัดหมายจากลูกบ้าน"}</p><p className="text-xs text-gray-400">สร้างเมื่อ {formatThaiDateTime(appointment.createdAt)}</p>{appointment.reviewNote ? <p className="text-sm text-gray-700"><span className="text-gray-500">ข้อความ/เหตุผลล่าสุด: </span>{appointment.reviewNote}</p> : null}</div></div>
      {appointment.stage === "CANCELLED" && (cancellationActor || cancellationReason) ? <div className="mt-4 border-t border-gray-200 pt-4 text-sm text-gray-700">
        {cancellationActor ? <p>ยกเลิกโดย {cancellationActor}</p> : null}
        {cancellationReason ? <p className="mt-1">เหตุผล: {cancellationReason}</p> : null}
      </div> : null}
    </section>
    {canProposeTime || canEditAdminCreated || canReject || canCancel ? <div className="flex flex-wrap justify-end gap-2">{canProposeTime || canEditAdminCreated ? <ProposeTimeForm appointmentId={appointment.id} mode={canProposeTime ? "PROPOSE_TIME" : "EDIT_ADMIN_CREATED"} initialTitle={appointment.title} initialDescription={appointment.description ?? ""} initialDate={initialDate} initialStartTime={initialStartTime} /> : null}<AppointmentStatusActions appointmentId={appointment.id} canReject={canReject} canCancel={canCancel} /></div> : null}
    <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
      <h2 className="font-semibold text-gray-900">ประวัติการดำเนินการ</h2>
      <AppointmentTimeline entries={appointment.timeline} villageId={appointment.villageId} />
    </section>
  </div>;
}
