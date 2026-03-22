import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APPOINTMENT_STAGE_LABELS } from "@/lib/constants";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AppointmentsCalendar } from "./appointments-calendar";
import { ResidentAppointmentCard } from "./resident-appointment-card";

interface PageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

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

export default async function AppointmentsPage({ searchParams }: PageProps) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const params = await searchParams;
  const now = new Date();
  const month = Math.min(12, Math.max(1, parseInt(params.month ?? "", 10) || (now.getMonth() + 1)));
  const year = parseInt(params.year ?? "", 10) || now.getFullYear();

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  // Get user's active village
  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });

  // Fetch slots for this month — mark dates as busy when blocked OR at full capacity
  let blockedDates: string[] = [];
  if (membership) {
    const slots = await prisma.appointmentSlot.findMany({
      where: {
        villageId: membership.villageId,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      include: {
        _count: {
          select: {
            appointments: {
              where: { stage: { notIn: ["CANCELLED", "REJECTED"] } },
            },
          },
        },
      },
    });

    blockedDates = [
      ...new Set(
        slots
          .filter((s) => s.isBlocked || s._count.appointments >= s.maxCapacity)
          .map((s) => slotDateToStr(s.date))
      ),
    ];
  }

  // User's own active appointments within this month (for calendar highlights)
  const userMonthAppointments = await prisma.appointment.findMany({
    where: {
      userId: session.id,
      slot: { date: { gte: startOfMonth, lte: endOfMonth } },
      stage: { notIn: ["CANCELLED", "REJECTED"] },
    },
    include: { slot: true },
  });

  const userAppointmentDates = userMonthAppointments
    .filter((a) => a.slot)
    .map((a) => slotDateToStr(a.slot!.date));

  // Full appointment list (all time) for the list section below
  const allAppointments = await prisma.appointment.findMany({
    where: { userId: session.id },
    include: { slot: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">นัดหมาย</h1>
        <Link href="/resident/appointments/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" /> ขอจองนัด
          </Button>
        </Link>
      </div>

      {/* ─── Calendar ─── */}
      <AppointmentsCalendar
        year={year}
        month={month}
        blockedDates={blockedDates}
        userAppointmentDates={userAppointmentDates}
      />

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
