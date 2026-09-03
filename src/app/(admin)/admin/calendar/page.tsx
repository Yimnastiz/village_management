import Link from "next/link";
import { CalendarPlus, Inbox, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { NewsFilterChip } from "@/components/news/news-toolbar";
import type { ToolbarGroup } from "@/components/ui/admin-list-toolbar";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { parseCalendarMonth, toDateKey, toMonthKey } from "@/lib/calendar-month";
import { AdminCalendarGrid } from "./admin-calendar-grid";

type PageProps = {
  searchParams?: Promise<{ q?: string; visibility?: string; month?: string; date?: string }>;
};

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
  const activeVisibility = params.visibility === "PUBLIC" || params.visibility === "RESIDENT_ONLY" ? params.visibility : "ALL";

  const { year, monthIndex, yearStart, yearEnd } = parseCalendarMonth(params.month);
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

  const todayKey = toDateKey(new Date());
  const selectedDateKey = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) && params.date.startsWith(`${year}-${String(monthIndex + 1).padStart(2, "0")}-`) ? params.date : "";

  const eventsByDay = new Map<string, typeof events>();
  for (const event of events) {
    const key = toDateKey(event.startsAt);
    const existing = eventsByDay.get(key) ?? [];
    existing.push(event);
    eventsByDay.set(key, existing);
  }

  const appointmentsByDay = new Map<string, typeof appointments>();
  for (const apt of appointments) {
    if (!apt.scheduledAt) continue;
    const key = toDateKey(apt.scheduledAt);
    const existing = appointmentsByDay.get(key) ?? [];
    existing.push(apt);
    appointmentsByDay.set(key, existing);
  }

  const selectedDayEvents = selectedDateKey ? eventsByDay.get(selectedDateKey) ?? [] : [];
  const selectedDayAppointments = selectedDateKey ? appointmentsByDay.get(selectedDateKey) ?? [] : [];
  const weekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

  const pendingRequestCount = await prisma.villageEventSubmission.count({
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

  const filterGroups: ToolbarGroup[] = [{
    label: "การมองเห็น",
    options: [
      { label: "ทั้งหมด", href: buildCalendarHref({ q: keyword, visibility: "ALL", month: toMonthKey(monthStart) }), active: activeVisibility === "ALL", isDefault: true },
      { label: "สาธารณะ", href: buildCalendarHref({ q: keyword, visibility: "PUBLIC", month: toMonthKey(monthStart) }), active: activeVisibility === "PUBLIC" },
      { label: "ลูกบ้าน", href: buildCalendarHref({ q: keyword, visibility: "RESIDENT_ONLY", month: toMonthKey(monthStart) }), active: activeVisibility === "RESIDENT_ONLY" },
    ],
  }];

  return (
    <div data-admin-compact-top className="space-y-6">
      <CalendarToolbar
        namespace="admin-calendar"
        title="ปฏิทิน"
        description="เพิ่ม แก้ไข และลบกิจกรรมของหมู่บ้าน"
        currentYear={year}
        currentMonth={monthIndex + 1}
        yearStart={yearStart}
        yearEnd={yearEnd}
        todayMonthKey={toMonthKey(new Date())}
        search={{ keyword, placeholder: "ค้นหาชื่อกิจกรรม สถานที่ หรือรายละเอียด", suggestions: suggestionTitles }}
        actions={
          <>
            <Link href="/admin/calendar/requests" aria-label="คำขอกิจกรรม">
              <Button size="sm" variant="outline" className="h-11 px-2 sm:px-3">
                <Inbox className="h-4 w-4" />
                <span className="hidden sm:ml-1.5 sm:inline">คำขอกิจกรรม</span>
                {pendingRequestCount > 0 ? <span className="ml-1.5">({pendingRequestCount})</span> : null}
              </Button>
            </Link>
            <Link href="/admin/calendar/new">
              <Button size="sm" className="h-11 px-2 sm:px-3">
                <Plus className="h-4 w-4" />
                <span className="ml-1 hidden min-[360px]:inline">เพิ่มกิจกรรม</span>
              </Button>
            </Link>
          </>
        }
        filters={
          <>
            <span className="text-xs font-semibold text-gray-500">การมองเห็น</span>
            <NewsFilterChip href={buildCalendarHref({ q: keyword, visibility: "ALL", month: toMonthKey(monthStart) })} active={activeVisibility === "ALL"}>ทั้งหมด</NewsFilterChip>
            <NewsFilterChip href={buildCalendarHref({ q: keyword, visibility: "PUBLIC", month: toMonthKey(monthStart) })} active={activeVisibility === "PUBLIC"}>สาธารณะ</NewsFilterChip>
            <NewsFilterChip href={buildCalendarHref({ q: keyword, visibility: "RESIDENT_ONLY", month: toMonthKey(monthStart) })} active={activeVisibility === "RESIDENT_ONLY"}>ลูกบ้าน</NewsFilterChip>
            <NewsFilterChip href={buildCalendarHref({ month: toMonthKey(monthStart) })} active={false}>ล้างตัวกรอง</NewsFilterChip>
          </>
        }
        adminFilterGroups={filterGroups}
      />

      <AdminCalendarGrid
        key={`${toMonthKey(monthStart)}-${selectedDateKey ?? "none"}`}
        year={year}
        monthIndex={monthIndex}
        todayKey={todayKey}
        initialDate={selectedDateKey}
        searchKeyword={keyword}
        events={events.map((event) => ({ ...event, startsAt: event.startsAt.toISOString(), endsAt: event.endsAt?.toISOString() ?? null }))}
        appointments={appointments.filter((apt) => apt.scheduledAt).map((apt) => ({ id: apt.id, title: apt.title, scheduledAt: apt.scheduledAt!.toISOString(), userName: apt.user.name }))}
      />
      {false && daysInMonth === 0 ? (
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
              <div key={`blank-${index}`} className="min-h-16 border-b border-r border-gray-100 bg-gray-50/70 sm:min-h-24 lg:min-h-28" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1;
              const cellDate = new Date(year, monthIndex, day);
              const dayKey = toDateKey(cellDate);
              const dayEvents = eventsByDay.get(dayKey) ?? [];
              const dayAppointments = appointmentsByDay.get(dayKey) ?? [];
              const isSelected = selectedDateKey === dayKey;
              const isToday = dayKey === todayKey;
              const totalCount = dayEvents.length + dayAppointments.length;
              const dayDetailHref = buildCalendarHref({ q: keyword, visibility: activeVisibility, month: toMonthKey(monthStart), date: dayKey });

              return (
                <div key={dayKey} className={`relative min-h-16 min-w-0 border-b border-r border-gray-100 p-1 sm:min-h-24 sm:p-2 lg:min-h-28 ${isSelected ? "z-10 border-blue-800 bg-blue-700 text-white shadow-sm ring-2 ring-inset ring-blue-800" : "bg-white hover:bg-gray-50/80"} ${isToday && !isSelected ? "bg-red-50 ring-2 ring-inset ring-red-300" : ""} ${isToday && isSelected ? "ring-2 ring-inset ring-amber-300" : ""}`}>
                  <Link
                    href={dayDetailHref}
                    aria-label={`เลือกวันที่ ${cellDate.toLocaleDateString("th-TH")}`}
                    aria-current={isSelected ? "date" : undefined}
                    className="absolute inset-0 z-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
                  />
                  <div className="relative z-10 pointer-events-none">
                    <div className="mb-2 flex min-w-0 items-center justify-between gap-1">
                    <span className={`text-sm font-semibold ${isSelected ? "text-white" : isToday ? "text-red-600" : "text-gray-800"}`}>
                      {day}
                    </span>
                    {totalCount > 0 && (
                      <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-medium ${isSelected ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"}`}>
                        {totalCount}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {dayEvents.slice(0, 1).map((event) => (
                      <Link
                        key={event.id}
                        href={`/admin/calendar/${event.id}`}
                        className="pointer-events-auto relative z-20 hidden truncate rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-800 hover:bg-blue-100 sm:block"
                      >
                        {event.title}
                      </Link>
                    ))}
                    {dayAppointments.slice(0, 1).map((apt) => (
                      <Link
                        key={apt.id}
                        href={`/admin/appointments/${apt.id}`}
                        className="pointer-events-auto relative z-20 hidden truncate rounded-md bg-purple-50 px-2 py-1 text-xs text-purple-800 hover:bg-purple-100 sm:block"
                      >
                        <div className="truncate font-medium">{apt.title}</div>
                      </Link>
                    ))}
                    {totalCount > 2 && (
                      <Link
                        href={dayDetailHref}
                        className="pointer-events-auto relative z-20 block text-xs text-gray-500 hover:text-gray-700"
                      >
                        + อีก {totalCount - 2} รายการ
                      </Link>
                    )}
                  </div>
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

      {false && selectedDateKey && (
        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-gray-900 sm:text-lg">
              รายการในวันที่ {new Date(selectedDateKey).toLocaleDateString("th-TH")}
            </h2>
            <Badge variant="outline">
              {selectedDayEvents.length + selectedDayAppointments.length} รายการ
            </Badge>
          </div>

          {selectedDayEvents.length === 0 && selectedDayAppointments.length === 0 ? (
            <p className="text-sm text-gray-500">ไม่มีกิจกรรมหรือนัดหมายในวันนี้</p>
          ) : (
            <div className="space-y-2">
              {selectedDayAppointments.map((apt) => (
                <Link key={apt.id} href={`/admin/appointments/${apt.id}`} className="block rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 hover:border-purple-300 hover:bg-purple-100/50">
                  <p className="font-medium text-purple-900">{apt.title}</p>
                  <p className="text-sm text-purple-700">{apt.user.name}</p>
                </Link>
              ))}
              {selectedDayEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/admin/calendar/${event.id}`}
                  className="block rounded-lg border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50/40"
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
