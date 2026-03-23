import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { normalizeVillageSlugParam } from "@/lib/village-slug";

interface PageProps {
  params: Promise<{ villageSlug: string }>;
  searchParams: Promise<{ month?: string; date?: string }>;
}

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

export default async function Page({ params, searchParams }: PageProps) {
  const { villageSlug: rawVillageSlug } = await params;
  const villageSlug = normalizeVillageSlugParam(rawVillageSlug);
  const { month, date } = await searchParams;

  const village = await prisma.village.findUnique({
    where: { slug: villageSlug },
    select: { id: true, name: true },
  });
  if (!village) notFound();

  const { year, monthIndex } = parseMonth(month);
  const monthStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const nextMonthStart = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingBlankDays = monthStart.getDay();

  const events = await prisma.villageEvent.findMany({
    where: {
      villageId: village.id,
      isPublic: true,
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
    },
  });

  const eventsByDay = new Map<string, typeof events>();
  for (const event of events) {
    const key = toDateKey(event.startsAt);
    const existing = eventsByDay.get(key) ?? [];
    existing.push(event);
    eventsByDay.set(key, existing);
  }

  const selectedDateKey = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  const selectedDayEvents = selectedDateKey ? eventsByDay.get(selectedDateKey) ?? [] : [];

  const prevMonth = new Date(year, monthIndex - 1, 1);
  const nextMonth = new Date(year, monthIndex + 1, 1);
  const weekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ปฏิทินกิจกรรม</h1>
          <p className="text-sm text-gray-500 mt-1">กิจกรรมสาธารณะของ {village.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${villageSlug}/calendar?month=${toMonthKey(prevMonth)}`}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <p className="min-w-28 text-center text-sm font-medium text-gray-800">
            {monthStart.toLocaleDateString("th-TH", { month: "long", year: "numeric" })}
          </p>
          <Link
            href={`/${villageSlug}/calendar?month=${toMonthKey(nextMonth)}`}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {weekdays.map((day) => (
            <div key={day} className="px-2 py-2 text-center text-xs font-semibold text-gray-600">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: leadingBlankDays }).map((_, index) => (
            <div key={`blank-${index}`} className="min-h-28 border-r border-b border-gray-100 bg-gray-50/70" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, index) => {
            const day = index + 1;
            const cellDate = new Date(year, monthIndex, day);
            const dayKey = toDateKey(cellDate);
            const dayEvents = eventsByDay.get(dayKey) ?? [];
            const isSelected = selectedDateKey === dayKey;

            return (
              <div
                key={dayKey}
                className={`min-h-28 border-r border-b border-gray-100 p-2 ${
                  isSelected ? "bg-green-50" : "bg-white"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Link
                    href={`/${villageSlug}/calendar?month=${toMonthKey(monthStart)}&date=${dayKey}`}
                    className="text-sm font-medium text-gray-800 hover:text-green-700"
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
                  {dayEvents.slice(0, 2).map((event) => (
                    <Link
                      key={event.id}
                      href={`/${villageSlug}/calendar/${event.id}`}
                      className="block truncate rounded-md bg-green-50 px-2 py-1 text-xs text-green-800 hover:bg-green-100"
                    >
                      {event.title}
                    </Link>
                  ))}
                  {dayEvents.length > 2 && (
                    <Link
                      href={`/${villageSlug}/calendar?month=${toMonthKey(monthStart)}&date=${dayKey}`}
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
      </section>

      {selectedDateKey && (
        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
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
                  href={`/${villageSlug}/calendar/${event.id}`}
                  className="block rounded-lg border border-gray-200 px-4 py-3 hover:border-green-300 hover:bg-green-50/40"
                >
                  <p className="font-medium text-gray-900">{event.title}</p>
                  <p className="text-sm text-gray-500 mt-1">
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
