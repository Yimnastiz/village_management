import { notFound } from "next/navigation";
import { getPublicVillageBySlug, getVillageCalendarEvents } from "@/features/public-village/server/public-village-data";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { parseCalendarMonth, toDateKey, toMonthKey } from "@/lib/calendar-month";
import { ResidentCalendarGrid } from "@/app/(resident)/resident/calendar/resident-calendar-grid";

interface PageProps {
  params: Promise<{ villageSlug: string }>;
  searchParams: Promise<{ month?: string; date?: string; q?: string }>;
}

function parseSelectedDate(value: string | undefined, monthKey: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !value.startsWith(`${monthKey}-`)) return null;
  const parsed = new Date(`${value}T00:00:00+07:00`);
  return !Number.isNaN(parsed.getTime()) && toDateKey(parsed) === value ? value : null;
}

export default async function Page({ params, searchParams }: PageProps) {
  const { villageSlug: rawVillageSlug } = await params;
  const { month, date, q } = await searchParams;
  const village = await getPublicVillageBySlug(rawVillageSlug);
  if (!village) notFound();

  const villageSlug = village.slug;
  const { year, monthIndex, yearStart, yearEnd } = parseCalendarMonth(month);
  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const initialDate = parseSelectedDate(date, monthKey);
  const keyword = q?.trim() ?? "";
  const hasSearch = keyword.length > 0;
  const hasSelectedDate = initialDate !== null;
  const monthStart = new Date(year, monthIndex, 1);
  const nextMonthStart = new Date(year, monthIndex + 1, 1);
  const events = await getVillageCalendarEvents({
    villageId: village.id,
    startsAt: monthStart,
    endsBefore: nextMonthStart,
    publicOnly: true,
    keyword,
  });
  const hasSelectedDateEvent = initialDate
    ? events.some((event) => {
        const startKey = toDateKey(event.startsAt);
        const endKey = event.endsAt ? toDateKey(event.endsAt) : startKey;
        return initialDate >= startKey && initialDate <= endKey;
      })
    : false;
  const hasNoMatchingEvents = hasSelectedDate ? !hasSelectedDateEvent : events.length === 0;
  const showFilteredEmptyState = hasNoMatchingEvents && (hasSearch || hasSelectedDate);
  let emptyStateMessage: string | null = null;
  if (hasSearch && hasSelectedDate) {
    emptyStateMessage = "ไม่พบกิจกรรมตามเงื่อนไขที่เลือก";
  } else if (hasSearch) {
    emptyStateMessage = "ไม่พบกิจกรรมที่ตรงกับคำค้นหา";
  } else if (hasSelectedDate) {
    emptyStateMessage = "ไม่มีกิจกรรมในวันที่เลือก";
  }

  return (
    <div className="space-y-4">
      <CalendarToolbar
        namespace="public-calendar"
        hideHeading
        residentCompact
        currentYear={year}
        currentMonth={monthIndex + 1}
        yearStart={yearStart}
        yearEnd={yearEnd}
        todayMonthKey={toMonthKey(new Date())}
        todayDateKey={toDateKey(new Date())}
        selectToday
        publicFullBleed
        search={{ keyword, placeholder: "ค้นหากิจกรรม", label: "ค้นหากิจกรรม" }}
        className="mt-0"
      />
      {showFilteredEmptyState && emptyStateMessage ? <p className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">{emptyStateMessage}</p> : null}
      <ResidentCalendarGrid
        key={`${monthKey}-${initialDate ?? "none"}-${keyword}`}
        year={year}
        monthIndex={monthIndex}
        todayKey={toDateKey(new Date())}
        initialDate={initialDate}
        showAppointments={false}
        searchKeyword={keyword}
        eventHrefBase={`/${villageSlug}/calendar`}
        events={events.map((event) => ({ id: event.id, title: event.title, startsAt: event.startsAt.toISOString(), endsAt: event.endsAt?.toISOString() ?? null, location: event.location, isPublic: event.isPublic }))}
        appointments={[]}
      />
    </div>
  );
}
