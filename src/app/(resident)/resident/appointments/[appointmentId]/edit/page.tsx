import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { EditAppointmentForm } from "./edit-form";
export default async function EditAppointmentPage({ params }: { params: Promise<{ appointmentId: string }> }) { const session = await getSessionContextFromServerCookies(); if (!session?.id) redirect("/auth/login"); const { appointmentId } = await params; const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, userId: session.id, stage: "PENDING_APPROVAL" } }); if (!appointment) redirect(`/resident/appointments/${appointmentId}`); return <div className="mx-auto max-w-2xl space-y-4"><h1 className="text-2xl font-bold text-gray-900">แก้ไขคำขอนัดหมาย</h1><EditAppointmentForm appointmentId={appointment.id} title={appointment.title} description={appointment.description ?? ""} /></div>; }
