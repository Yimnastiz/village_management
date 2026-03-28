import Link from "next/link";
import { ChevronLeft, ChevronRight, FilePlus2 } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

type ResidentCalendarPageProps = {
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

export default async function ResidentVillageCalendarPage({ searchParams }: ResidentCalendarPageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/auth/login");

  const village = await prisma.village.findUnique({
    where: { id: membership.villageId },
    select: { id: true, name: true },
  });
  if (!village) redirect("/auth/login");

  const { year, monthIndex } = parseMonth(params.month);
  const monthStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const nextMonthStart = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingBlankDays = monthStart.getDay();

  const events = await prisma.villageEvent.findMany({
    where: {
      villageId: village.id,
      startsAt: {
        gte: monthStart,
        lt: nextMonthStart,
      },
    },
    orderBy: [{ startsAt: "asc" }],
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      location: true,
      isPublic: true,
    },
  });

  const userAppointments = await prisma.appointment.findMany({
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
  });

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

  const prevMonth = new Date(year, monthIndex - 1, 1);
  const nextMonth = new Date(year, monthIndex + 1, 1);
  const weekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ปฏิทินกิจกรรมหมู่บ้าน</h1>
          <p className="mt-1 text-sm text-gray-500">ดูกิจกรรมทั้งหมดของ {village.name}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Link href="/resident/calendar/requests">
            <Button size="sm" variant="outline">คำขอกิจกรรมของฉัน</Button>
          </Link>
          <Link href="/resident/calendar/requests/new">
            <Button size="sm">
              <FilePlus2 className="mr-1 h-4 w-4" /> ขอเพิ่มกิจกรรม
            </Button>
          </Link>
          <Link
            href={`/resident/calendar?month=${toMonthKey(prevMonth)}`}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <p className="min-w-28 text-center text-sm font-medium text-gray-800">
            {monthStart.toLocaleDateString("th-TH", { month: "long", year: "numeric" })}
          </p>
          <Link
            href={`/resident/calendar?month=${toMonthKey(nextMonth)}`}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

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
              <div key={`blank-${index}`} className="min-h-28 border-b border-r border-gray-100 bg-gray-50/70" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1;
              const cellDate = new Date(year, monthIndex, day);
              const dayKey = toDateKey(cellDate);
              const dayEvents = eventsByDay.get(dayKey) ?? [];
              const isSelected = selectedDateKey === dayKey;
              const isToday = dayKey === todayKey;
              const hasMyAppointment = userAppointmentDateKeys.has(dayKey);

              return (
                <div
                  key={dayKey}
                  className={`min-h-28 border-b border-r border-gray-100 p-2 ${isSelected ? "bg-green-50" : "bg-white"} ${
                    hasMyAppointment ? "ring-1 ring-inset ring-sky-300" : ""
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <Link
                      href={`/resident/calendar?month=${toMonthKey(monthStart)}&date=${dayKey}`}
                      className={`text-sm font-medium hover:text-green-700 ${
                        isToday ? "text-red-600" : "text-gray-800"
                      }`}
                    >
                      {day}
                    </Link>
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
                        className="block truncate rounded-md bg-green-50 px-2 py-1 text-xs text-green-800 hover:bg-green-100"
                      >
                        {event.title}
                      </Link>
                    ))}
                    {dayEvents.length > 2 && (
                      <Link
                        href={`/resident/calendar?month=${toMonthKey(monthStart)}&date=${dayKey}`}
                        className="block text-xs text-gray-500 hover:text-gray-700"
                      >
                        + อีก {dayEvents.length - 2} รายการ
                      </Link>
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
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-sky-500" /> มีนัดหมายของคุณ
              </span>
            </div>
          </div>
        </section>
      )}

      {selectedDateKey && (
        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
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
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{event.title}</p>
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