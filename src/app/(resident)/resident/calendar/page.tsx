import Link from "next/link";
import { FilePlus2, ListChecks } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { EmptyState } from "@/components/ui/empty-state";
import { getResidentVillageAccess, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { getVillageCalendarEvents } from "@/features/public-village/server/public-village-data";
import { parseCalendarMonth, toDateKey, toMonthKey } from "@/lib/calendar-month";

type ResidentCalendarPageProps = {
  searchParams?: Promise<{ month?: string; date?: string }>;
};

export default async function ResidentVillageCalendarPage({ searchParams }: ResidentCalendarPageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = await getResidentVillageAccess(session);
  if (!membership) redirect("/resident/dashboard");

  const village = await prisma.village.findUnique({
    where: { id: membership.villageId },
    select: { id: true, name: true },
  });
  if (!village) redirect("/auth/login");

  const { year, monthIndex, yearStart, yearEnd } = parseCalendarMonth(params.month);
  const monthStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const nextMonthStart = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingBlankDays = monthStart.getDay();

  const events = await getVillageCalendarEvents({ villageId: village.id, startsAt: monthStart, endsBefore: nextMonthStart, publicOnly: !membership.hasResidentAccess });

  const userAppointments = membership.hasResidentAccess ? await prisma.appointment.findMany({
    where: {
      userId: session.id,
      stage: { notIn: ["CANCELLED", "REJECTED"] },
      slot: {
        date: {
          gte: monthStart,
          lt: nextMonthStart,
        },
      },
    },
    select: {
      slot: {
        select: {
          date: true,
        },
      },
    },
  }) : [];

  const userAppointmentDateKeys = new Set(
    userAppointments
      .map((appointment) => appointment.slot?.date)
      .filter((date): date is Date => date instanceof Date)
      .map((date) => toDateKey(date))
  );

  const todayKey = toDateKey(new Date());

  const eventsByDay = new Map<string, typeof events>();
  for (const event of events) {
    const key = toDateKey(event.startsAt);
    const existing = eventsByDay.get(key) ?? [];
    existing.push(event);
    eventsByDay.set(key, existing);
  }

  const selectedDateKey = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : null;
  const selectedDayEvents = selectedDateKey ? eventsByDay.get(selectedDateKey) ?? [] : [];

  const weekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

  return (
    <div className="space-y-6">
      <CalendarToolbar
        namespace="resident-calendar"
        title="ปฏิทิน"
        description={`ดูกิจกรรมทั้งหมดของ ${village.name}`}
        currentYear={year}
        currentMonth={monthIndex + 1}
        yearStart={yearStart}
        yearEnd={yearEnd}
        actions={membership.hasResidentAccess ? (
          <>
            <Link href="/resident/calendar/requests" aria-label="คำขอกิจกรรมของฉัน">
              <Button size="sm" variant="outline" className="h-10 px-2 sm:px-3">
                <ListChecks className="h-4 w-4" />
                <span className="hidden sm:ml-1.5 sm:inline">คำขอของฉัน</span>
              </Button>
            </Link>
            <Link href="/resident/calendar/requests/new">
              <Button size="sm" className="h-10 px-2 sm:px-3">
                <FilePlus2 className="h-4 w-4" />
                <span className="ml-1 hidden min-[390px]:inline">ขอเพิ่มกิจกรรม</span>
              </Button>
            </Link>
          </>
        ) : undefined}
      />

      {daysInMonth === 0 ? (
        <EmptyState title="ไม่พบข้อมูลปฏิทิน" description="ลองเปลี่ยนเดือนอีกครั้ง" />
      ) : (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {weekdays.map((day) => (
              <div key={day} className="px-2 py-2 text-center text-xs font-semibold text-gray-600">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: leadingBlankDays }).map((_, index) => (
              <div key={`blank-${index}`} className="min-h-16 border-b border-r border-gray-100 bg-gray-50/70 sm:min-h-24 lg:min-h-28" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1;
              const cellDate = new Date(year, monthIndex, day);
              const dayKey = toDateKey(cellDate);
              const dayEvents = eventsByDay.get(dayKey) ?? [];
              const isSelected = selectedDateKey === dayKey;
              const isToday = dayKey === todayKey;
              const hasMyAppointment = userAppointmentDateKeys.has(dayKey);
              const dayDetailHref = `/resident/calendar?month=${toMonthKey(monthStart)}&date=${dayKey}`;

              return (
                <div
                  key={dayKey}
                  className={`relative min-h-16 min-w-0 border-b border-r border-gray-100 p-1 transition-colors duration-200 sm:min-h-24 sm:p-2 lg:min-h-28 ${
                    isSelected ? "bg-green-50" : "bg-white hover:bg-gray-50/80"
                  } ${
                    hasMyAppointment ? "ring-1 ring-inset ring-sky-300" : ""
                  } ${isToday ? "bg-rose-50/70 ring-2 ring-inset ring-rose-300" : ""}`}
                >
                  <Link
                    href={dayDetailHref}
                    aria-label={`ดูรายละเอียดวันที่ ${cellDate.toLocaleDateString("th-TH")}`}
                    className="absolute inset-0 z-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-600"
                  />
                  <div className="relative z-10 pointer-events-none">
                    <div className="mb-2 flex min-w-0 items-center justify-between gap-1">
                    <span className={`text-xs font-medium sm:text-sm ${
                      isToday ? "rounded-full bg-rose-600 px-2 py-0.5 text-white shadow-sm" : "text-gray-800"
                    }`}>
                      {day}
                    </span>
                    {isToday && (
                      <span className="hidden items-center rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 lg:inline-flex">
                        วันนี้
                      </span>
                    )}
                    {dayEvents.length > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-green-100 px-1 text-xs font-medium text-green-700">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {hasMyAppointment && (
                      <span className="inline-flex w-fit items-center rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                        มีนัดหมายของคุณ
                      </span>
                    )}
                    {dayEvents.slice(0, 2).map((event) => (
                      <Link
                        key={event.id}
                        href={`/resident/calendar/${event.id}`}
                        className="pointer-events-auto relative z-20 hidden truncate rounded-md bg-green-50 px-2 py-1 text-xs text-green-800 hover:bg-green-100 sm:block"
                      >
                        {event.title}
                      </Link>
                    ))}
                    {dayEvents.length > 2 && (
                      <Link
                        href={dayDetailHref}
                        className="pointer-events-auto relative z-20 block text-xs text-gray-500 hover:text-gray-700"
                      >
                        + อีก {dayEvents.length - 2} รายการ
                      </Link>
                    )}
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-gray-200 bg-gray-50 px-3 py-2">
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-600" /> วันนี้
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-sky-500" /> มีนัดหมายของคุณ
              </span>
            </div>
          </div>
        </section>
      )}

      {selectedDateKey && (
        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-gray-900 sm:text-lg">
              รายการกิจกรรมวันที่ {new Date(selectedDateKey).toLocaleDateString("th-TH")}
            </h2>
            <Badge variant="outline">{selectedDayEvents.length} รายการ</Badge>
          </div>

          {selectedDayEvents.length === 0 ? (
            <p className="text-sm text-gray-500">ไม่มีกิจกรรมในวันนี้</p>
          ) : (
            <div className="space-y-2">
              {selectedDayEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/resident/calendar/${event.id}`}
                  className="block rounded-lg border border-gray-200 px-4 py-3 hover:border-green-300 hover:bg-green-50/40"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 font-medium text-gray-900">{event.title}</p>
                    <Badge variant={event.isPublic ? "success" : "info"}>
                      {event.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {event.startsAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                    {event.endsAt
                      ? ` - ${event.endsAt.toLocaleTimeString("th-TH", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : ""}
                    {event.location ? ` • ${event.location}` : ""}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
