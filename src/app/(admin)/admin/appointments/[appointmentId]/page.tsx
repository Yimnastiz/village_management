import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { Badge } from "@/components/ui/badge";
import { APPOINTMENT_STAGE_LABELS } from "@/lib/constants";
import { formatThaiDate } from "@/lib/utils";
import { ProposeTimeForm } from "./propose-time-form";

export default async function AdminAppointmentDetailPage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const session = await getSessionContextFromServerCookies(); if (!session?.id || !isAdminUser(session)) redirect("/auth/login");
  const { appointmentId } = await params;
  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, village: { memberships: { some: { userId: session.id, status: "ACTIVE", role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] } } } } }, include: { user: { select: { name: true, email: true, phoneNumber: true } }, slot: true, timeline: { orderBy: { createdAt: "desc" } } } });
  if (!appointment) redirect("/admin/appointments");
  const stageLabel = appointment.stage === "TIME_SUGGESTED" ? "รอลูกบ้านยืนยันเวลา" : APPOINTMENT_STAGE_LABELS[appointment.stage];
  return <div className="mx-auto max-w-3xl space-y-5"><Link href="/admin/appointments" className="text-sm text-gray-500 hover:text-gray-800">← กลับคำขอนัดหมาย</Link><section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-xl font-bold text-gray-900">{appointment.title}</h1><p className="mt-1 text-sm text-gray-600">{appointment.description}</p></div><Badge variant={appointment.stage === "APPROVED" ? "success" : appointment.stage === "TIME_SUGGESTED" ? "info" : "warning"}>{stageLabel}</Badge></div><div className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-2"><p><span className="text-gray-500">ผู้ขอ: </span>{appointment.user.name || appointment.user.email}</p><p><span className="text-gray-500">ติดต่อ: </span>{appointment.user.phoneNumber || "-"}</p>{appointment.slot ? <><p><span className="text-gray-500">{appointment.stage === "TIME_SUGGESTED" ? "วันที่เสนอ: " : "วันที่นัดหมาย: "}</span>{formatThaiDate(appointment.slot.date)}</p><p><span className="text-gray-500">{appointment.stage === "TIME_SUGGESTED" ? "เวลาเสนอ: " : "เวลานัดหมาย: "}</span>{appointment.slot.startTime} - {appointment.slot.endTime}</p></> : null}{appointment.reviewNote ? <p className="sm:col-span-2"><span className="text-gray-500">ข้อความ/เหตุผลล่าสุด: </span>{appointment.reviewNote}</p> : null}</div></section>{["PENDING_APPROVAL", "TIME_SUGGESTED", "APPROVED"].includes(appointment.stage) ? <ProposeTimeForm appointmentId={appointment.id} title={appointment.title} description={appointment.description ?? ""} canReject={appointment.stage === "PENDING_APPROVAL"} canCancel={true} /> : null}</div>;
}
