import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { parseCalendarMonth, toDateKey, toMonthKey } from "@/lib/calendar-month";
import { prisma } from "@/lib/prisma";
import { AdminAppointmentCalendarGrid } from "./admin-appointment-calendar-grid";

type PageProps = { searchParams?: Promise<{ month?: string; date?: string }> };

function validSelectedDate(value: string | undefined, monthKey: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && value.startsWith(`${monthKey}-`) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime()) ? value : null;
}

function appointmentTime(slotStartTime: string | null | undefined, scheduledAt: Date | null) {
  if (slotStartTime) return slotStartTime;
  if (!scheduledAt) return null;
  return scheduledAt.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false });
}

function appointmentSortTime(slotStartTime: string | null | undefined, scheduledAt: Date | null) {
  if (slotStartTime) return `0-${slotStartTime}`;
  if (scheduledAt) return `1-${scheduledAt.toISOString()}`;
  return null;
}

export default async function Page({ searchParams }: PageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({ where: { userId: session.id, status: "ACTIVE" }, select: { villageId: true } });
  if (!membership) redirect("/auth/login");

  const { year, monthIndex, yearStart, yearEnd } = parseCalendarMonth(params.month);
  const monthStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const nextMonthStart = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);
  const monthKey = toMonthKey(monthStart);
  const selectedDate = validSelectedDate(params.date, monthKey);
  const appointments = await prisma.appointment.findMany({
    where: { villageId: membership.villageId, stage: "APPROVED", scheduledAt: { gte: monthStart, lt: nextMonthStart } },
    select: { id: true, title: true, scheduledAt: true, user: { select: { name: true } }, slot: { select: { startTime: true } } },
    orderBy: [{ scheduledAt: "asc" }],
  });

  const calendarAppointments = appointments.map((appointment) => ({
    id: appointment.id,
    title: appointment.title,
    residentName: appointment.user.name,
    date: toDateKey(appointment.scheduledAt!),
    time: appointmentTime(appointment.slot?.startTime, appointment.scheduledAt),
    sortTime: appointmentSortTime(appointment.slot?.startTime, appointment.scheduledAt),
  }));

  return <div data-admin-compact-top className="space-y-6">
    <CalendarToolbar
      namespace="admin-appointment-calendar"
      title="ปฏิทินนัดหมาย"
      currentYear={year}
      currentMonth={monthIndex + 1}
      yearStart={yearStart}
      yearEnd={yearEnd}
      todayMonthKey={toMonthKey(new Date())}
      currentMonthLabel="เดือนนี้"
      leadingActions={<Link href="/admin/appointments" className="inline-flex h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-1"><ArrowLeft className="h-4 w-4" aria-hidden="true" />กลับรายการนัดหมาย</Link>}
    />
    <AdminAppointmentCalendarGrid year={year} monthIndex={monthIndex} todayKey={toDateKey(new Date())} initialDate={selectedDate} appointments={calendarAppointments} />
  </div>;
}
