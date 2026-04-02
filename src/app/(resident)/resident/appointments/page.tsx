import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APPOINTMENT_STAGE_LABELS } from "@/lib/constants";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ResidentAppointmentCard } from "./resident-appointment-card";

const stageVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING_APPROVAL: "warning",
  TIME_SUGGESTED: "info",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "default",
  COMPLETED: "info",
};

function slotDateToStr(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export default async function AppointmentsPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  // Full appointment list (all time) for the list section below
  const allAppointments = await prisma.appointment.findMany({
    where: { userId: session.id },
    include: { slot: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900">นัดหมาย</h1>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Link href="/resident/calendar">
            <Button size="sm" variant="outline" className="w-full sm:w-auto">
              <CalendarDays className="h-4 w-4 mr-1" /> ดูในปฏิทิน
            </Button>
          </Link>
          <Link href="/resident/appointments/new">
            <Button size="sm" className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" /> ขอจองนัด
            </Button>
          </Link>
        </div>
      </div>

      {/* ─── Appointment list ─── */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">รายการนัดหมายของคุณ</h2>
        {allAppointments.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500">
              ยังไม่มีนัดหมาย{" "}
              <Link href="/resident/appointments/new" className="text-green-600 hover:underline">
                ขอจองนัดหมายใหม่
              </Link>
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {allAppointments.map((apt) => (
              <ResidentAppointmentCard
                key={apt.id}
                id={apt.id}
                title={apt.title}
                stage={apt.stage}
                stageLabel={APPOINTMENT_STAGE_LABELS[apt.stage]}
                stageVariant={stageVariant[apt.stage] ?? "default"}
                slotDate={apt.slot?.date ? slotDateToStr(apt.slot.date) : null}
                slotStartTime={apt.slot?.startTime ?? null}
                slotEndTime={apt.slot?.endTime ?? null}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
