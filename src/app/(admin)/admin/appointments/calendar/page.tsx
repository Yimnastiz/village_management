import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";

type PageProps = {
  searchParams?: Promise<{ month?: string; date?: string }>;
};

function parseMonth(month?: string) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    const now = new Date();
    return { year: now.getFullYear(), monthIndex: now.getMonth() };
  }

  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;

  if (Number.isNaN(year) || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    const now = new Date();
    return { year: now.getFullYear(), monthIndex: now.getMonth() };
  }

  return { year, monthIndex };
}

function toDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(value);
}

function toMonthKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default async function Page({ searchParams }: PageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const { year, monthIndex } = parseMonth(params.month);
  const monthStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const nextMonthStart = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingBlankDays = monthStart.getDay();

  const appointments = await prisma.appointment.findMany({
    where: {
      villageId: membership.villageId,
      stage: { notIn: ["CANCELLED", "REJECTED"] },
      scheduledAt: {
        gte: monthStart,
        lt: nextMonthStart,
      },
    },
    select: {
      id: true,
      title: true,
      scheduledAt: true,
      user: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ scheduledAt: "asc" }],
  });

  const appointmentsByDay = new Map<string, typeof appointments>();
  for (const apt of appointments) {
    if (!apt.scheduledAt) continue;
    const key = toDateKey(apt.scheduledAt);
    const existing = appointmentsByDay.get(key) ?? [];
    existing.push(apt);
    appointmentsByDay.set(key, existing);
  }

  const todayKey = toDateKey(new Date());
  const selectedDateKey = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : null;
  const selectedDayAppointments = selectedDateKey ? appointmentsByDay.get(selectedDateKey) ?? [] : [];

  const prevMonth = new Date(year, monthIndex - 1, 1);
  const nextMonth = new Date(year, monthIndex + 1, 1);
  const weekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ปฏิทินนัดหมาย</h1>
        <p className="mt-1 text-sm text-gray-500">ดูนัดหมายของผู้ใหญ่บ้าน</p>
      </div>

      {daysInMonth === 0 ? (
        <EmptyState title="ไม่พบข้อมูลปฏิทิน" description="ลองเปลี่ยนเดือนอีกครั้ง" />
      ) : (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
            <Link
              href={`/admin/appointments/calendar?month=${toMonthKey(prevMonth)}`}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <p className="min-w-28 text-center text-sm font-medium text-gray-800">
              {monthStart.toLocaleDateString("th-TH", { month: "long", year: "numeric" })}
            </p>
            <Link
              href={`/admin/appointments/calendar?month=${toMonthKey(nextMonth)}`}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {weekdays.map((day) => (
              <div key={day} className="px-2 py-2 text-center text-xs font-semibold text-gray-600">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: leadingBlankDays }).map((_, index) => (
              <div key={`blank-${index}`} className="min-h-28 border-b border-r border-gray-100 bg-gray-50/70" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1;
              const cellDate = new Date(year, monthIndex, day);
              const dayKey = toDateKey(cellDate);
              const dayAppointments = appointmentsByDay.get(dayKey) ?? [];
              const isSelected = selectedDateKey === dayKey;
              const isToday = dayKey === todayKey;

              return (
                  <div
                    key={dayKey}
                  className={`min-h-28 border-b border-r border-gray-100 p-2 ${isSelected ? "bg-blue-50" : "bg-white"}`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <Link
                      href={`/admin/appointments/calendar?month=${toMonthKey(monthStart)}&date=${dayKey}`}
                      className={`text-sm font-medium hover:text-blue-700 ${
                        isToday ? "text-red-600" : "text-gray-800"
                      }`}
                      >
                        {day}
                      </Link>
                      {dayAppointments.length > 0 && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 px-1 text-xs font-medium text-blue-700">
                          {dayAppointments.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                    {dayAppointments.slice(0, 2).map((apt) => (
                      <Link
                        href={`/admin/appointments/${apt.id}`}
                        key={apt.id}
                        className="block truncate rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-800 hover:bg-blue-100"
                      >
                        <div className="font-medium truncate">{apt.title}</div>
                        <div className="text-blue-600 truncate">{apt.user.name}</div>
                      </Link>
                    ))}
                    {dayAppointments.length > 2 && (
                      <div className="text-xs text-gray-500">
                        + อีก {dayAppointments.length - 2} รายการ
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-gray-200 bg-gray-50 px-3 py-2">
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500" /> วันนี้
              </span>
            </div>
          </div>
        </section>
      )}

      {selectedDateKey && selectedDayAppointments.length > 0 && (
        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">
            นัดหมายในวัน {new Date(`${selectedDateKey}T00:00:00`).toLocaleDateString("th-TH", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </h2>
          <div className="space-y-2">
            {selectedDayAppointments.map((apt) => (
              <Link key={apt.id} href={`/admin/appointments/${apt.id}`} className="block rounded-lg border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50/40">
                <p className="font-medium text-gray-900">{apt.title}</p>
                <p className="text-sm text-gray-600">{apt.user.name}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
