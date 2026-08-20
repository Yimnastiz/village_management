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

export default async function AdminAppointmentDetailPage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const session = await getSessionContextFromServerCookies(); if (!session?.id || !isAdminUser(session)) redirect("/auth/login");
  const { appointmentId } = await params;
  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, village: { memberships: { some: { userId: session.id, status: "ACTIVE", role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] } } } } }, include: { user: { select: { name: true, email: true, phoneNumber: true } }, slot: true, timeline: { orderBy: { createdAt: "asc" }, take: 1, select: { actorId: true, action: true, metadata: true, actor: { select: { name: true, email: true, memberships: { where: { status: "ACTIVE" }, select: { role: true }, take: 1 } } } } } } });
  if (!appointment) redirect("/admin/appointments");
  const stageLabel = appointment.stage === "TIME_SUGGESTED" ? "รอลูกบ้านยืนยันเวลา" : APPOINTMENT_STAGE_LABELS[appointment.stage];
  const isConfirmed = ["APPROVED", "COMPLETED"].includes(appointment.stage);
  const source = getAppointmentSource(appointment.timeline);
  const canProposeTime = !source.isAdminCreated && appointment.stage === "PENDING_APPROVAL";
  const canEditAdminCreated = source.isAdminCreated && source.creatorId === session.id && appointment.stage === "TIME_SUGGESTED";
  const initialDate = appointment.slot?.date.toISOString().slice(0, 10) ?? "";
  const initialStartTime = appointment.slot?.startTime ?? "";
  return <div className="mx-auto max-w-3xl space-y-5">
    <Link href="/admin/appointments" className="text-sm text-gray-500 hover:text-gray-800">← กลับรายการนัดหมาย</Link>
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-xl font-bold text-gray-900">{appointment.title}</h1>{appointment.description ? <p className="mt-1 text-sm text-gray-600">{appointment.description}</p> : null}</div><Badge variant={appointment.stage === "APPROVED" ? "success" : appointment.stage === "TIME_SUGGESTED" ? "info" : "warning"}>{stageLabel}</Badge></div>
      <div className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
        <p><span className="text-gray-500">นัดหมายกับ: </span>{appointment.user.name || appointment.user.email}</p>
        <p><span className="text-gray-500">ติดต่อ: </span>{appointment.user.phoneNumber || "-"}</p>
        <p className="sm:col-span-2 text-gray-600"><span className="text-gray-500">ที่มา: </span>{source.label ?? "คำขอนัดหมายจากลูกบ้าน"}</p>
        {appointment.slot ? <p className="flex items-center gap-1.5 font-medium text-gray-900 sm:col-span-2"><Clock aria-hidden className="h-4 w-4 shrink-0 text-gray-500" />{isConfirmed ? "นัดหมาย" : "เสนอเวลา"}: {formatThaiDate(appointment.slot.date)} เวลา {appointment.slot.startTime}</p> : null}
        <p className="text-xs text-gray-400 sm:col-span-2">สร้างเมื่อ {formatThaiDateTime(appointment.createdAt)}</p>
        {appointment.reviewNote ? <p className="sm:col-span-2"><span className="text-gray-500">ข้อความ/เหตุผลล่าสุด: </span>{appointment.reviewNote}</p> : null}
      </div>
    </section>
    {canProposeTime || canEditAdminCreated ? <div className="flex justify-end"><ProposeTimeForm appointmentId={appointment.id} mode={canProposeTime ? "PROPOSE_TIME" : "EDIT_ADMIN_CREATED"} initialTitle={appointment.title} initialDescription={appointment.description ?? ""} initialDate={initialDate} initialStartTime={initialStartTime} /></div> : null}
  </div>;
}
