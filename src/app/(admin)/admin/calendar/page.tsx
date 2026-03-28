import Link from "next/link";
import { CalendarPlus, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";

type VillageEventSubmissionCountDelegate = {
  count(args: unknown): Promise<number>;
};

type PageProps = {
  searchParams?: Promise<{ q?: string; visibility?: string; month?: string; date?: string }>;
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

export default async function AdminCalendarPage({ searchParams }: PageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const keyword = params.q?.trim() ?? "";
  const activeVisibility = params.visibility ?? "ALL";

  const { year, monthIndex } = parseMonth(params.month);
  const monthStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const nextMonthStart = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingBlankDays = monthStart.getDay();

  const where: Prisma.VillageEventWhereInput = { villageId: membership.villageId };
  if (activeVisibility === "PUBLIC") {
    where.isPublic = true;
  } else if (activeVisibility === "RESIDENT_ONLY") {
    where.isPublic = false;
  }
  where.startsAt = { gte: monthStart, lt: nextMonthStart };
  if (keyword) {
    where.OR = [
      { title: { contains: keyword, mode: "insensitive" } },
      { location: { contains: keyword, mode: "insensitive" } },
      { description: { contains: keyword, mode: "insensitive" } },
    ];
  }

  const events = await prisma.villageEvent.findMany({
    where,
    orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      location: true,
      startsAt: true,
      endsAt: true,
      isPublic: true,
    },
  });

  const todayKey = toDateKey(new Date());
  const selectedDateKey = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : null;

  const eventsByDay = new Map<string, typeof events>();
  for (const event of events) {
    const key = toDateKey(event.startsAt);
    const existing = eventsByDay.get(key) ?? [];
    existing.push(event);
    eventsByDay.set(key, existing);
  }

  const selectedDayEvents = selectedDateKey ? eventsByDay.get(selectedDateKey) ?? [] : [];
  const prevMonth = new Date(year, monthIndex - 1, 1);
  const nextMonth = new Date(year, monthIndex + 1, 1);
  const weekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

  const villageEventSubmission = (
    prisma as unknown as { villageEventSubmission: VillageEventSubmissionCountDelegate }
  ).villageEventSubmission;

  const pendingRequestCount = await villageEventSubmission.count({
    where: {
      villageId: membership.villageId,
      status: "PENDING",
    },
  });

  const suggestionTitles = Array.from(new Set(events.map((event) => event.title))).slice(0, 12);

  function buildCalendarHref(next: { q?: string; visibility?: string; month?: string; date?: string }) {
    const query = new URLSearchParams();
    const q = next.q?.trim() ?? "";
    const visibility = next.visibility ?? "ALL";
    const month = next.month;
    const date = next.date;
    if (q) query.set("q", q);
    if (visibility !== "ALL") query.set("visibility", visibility);
    if (month) query.set("month", month);
    if (date) query.set("date", date);
    const queryString = query.toString();
    return queryString ? `/admin/calendar?${queryString}` : "/admin/calendar";
  }

  return (
    <div className="space-y-6">
      <AdminListToolbar
        title="ปฏิทินกิจกรรม"
        description="เพิ่ม แก้ไข และลบกิจกรรมของหมู่บ้าน"
        searchAction="/admin/calendar"
        keyword={keyword}
        searchPlaceholder="ค้นหาชื่อกิจกรรม สถานที่ หรือรายละเอียด"
        hiddenInputs={{ visibility: activeVisibility === "ALL" ? "" : activeVisibility, month: toMonthKey(monthStart), date: selectedDateKey ?? "" }}
        suggestionTitles={suggestionTitles}
        groups={[
          {
            label: "การมองเห็น",
            options: [
              { label: "ทั้งหมด", href: buildCalendarHref({ q: keyword, visibility: "ALL", month: toMonthKey(monthStart), date: selectedDateKey ?? undefined }), active: activeVisibility === "ALL" },
              { label: "สาธารณะ", href: buildCalendarHref({ q: keyword, visibility: "PUBLIC", month: toMonthKey(monthStart), date: selectedDateKey ?? undefined }), active: activeVisibility === "PUBLIC" },
              { label: "ลูกบ้าน", href: buildCalendarHref({ q: keyword, visibility: "RESIDENT_ONLY", month: toMonthKey(monthStart), date: selectedDateKey ?? undefined }), active: activeVisibility === "RESIDENT_ONLY" },
            ],
          },
        ]}
        actions={
          <>
            <Link href="/admin/calendar/requests">
              <Button size="sm" variant="outline">
                คำขอกิจกรรม {pendingRequestCount > 0 ? `(${pendingRequestCount})` : ""}
              </Button>
            </Link>
            <Link href="/admin/calendar/new">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> เพิ่มกิจกรรม
              </Button>
            </Link>
          </>
        }
      />

      <div className="flex items-center justify-end gap-2">
        <Link
          href={buildCalendarHref({ q: keyword, visibility: activeVisibility, month: toMonthKey(prevMonth) })}
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <p className="min-w-28 text-center text-sm font-medium text-gray-800">
          {monthStart.toLocaleDateString("th-TH", { month: "long", year: "numeric" })}
        </p>
        <Link
          href={buildCalendarHref({ q: keyword, visibility: activeVisibility, month: toMonthKey(nextMonth) })}
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {daysInMonth === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <CalendarPlus className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">ไม่พบข้อมูลปฏิทิน</p>
        </div>
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

              return (
                <div key={dayKey} className={`min-h-28 border-b border-r border-gray-100 p-2 ${isSelected ? "bg-blue-50" : "bg-white"}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <Link
                      href={buildCalendarHref({ q: keyword, visibility: activeVisibility, month: toMonthKey(monthStart), date: dayKey })}
                      className={`text-sm font-medium hover:text-blue-700 ${isToday ? "text-red-600" : "text-gray-800"}`}
                    >
                      {day}
                    </Link>
                    {dayEvents.length > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 px-1 text-xs font-medium text-blue-700">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((event) => (
                      <Link
                        key={event.id}
                        href={`/admin/calendar/${event.id}`}
                        className="block truncate rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-800 hover:bg-blue-100"
                      >
                        {event.title}
                      </Link>
                    ))}
                    {dayEvents.length > 2 && (
                      <Link
                        href={buildCalendarHref({ q: keyword, visibility: activeVisibility, month: toMonthKey(monthStart), date: dayKey })}
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
            <span className="inline-flex items-center gap-1 text-xs text-gray-600">
              <span className="h-2 w-2 rounded-full bg-red-500" /> วันนี้
            </span>
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
                  href={`/admin/calendar/${event.id}`}
                  className="block rounded-lg border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50/40"
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
