import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import { getPublicVillageBySlug, getVillageCalendarEvents } from "@/features/public-village/server/public-village-data";
import { parseCalendarMonth, toDateKey, toMonthKey } from "@/lib/calendar-month";
import { ResidentCalendarGrid } from "@/app/(resident)/resident/calendar/resident-calendar-grid";

interface PageProps {
  params: Promise<{ villageSlug: string }>;
  searchParams: Promise<{ month?: string; date?: string }>;
}

export default async function Page({ params, searchParams }: PageProps) {
  const { villageSlug: rawVillageSlug } = await params;
  const { month, date } = await searchParams;
  const village = await getPublicVillageBySlug(rawVillageSlug);
  if (!village) notFound();

  const villageSlug = village.slug;
  const { year, monthIndex } = parseCalendarMonth(month);
  const expectedMonth = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const initialDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date.startsWith(`${expectedMonth}-`) && !Number.isNaN(new Date(`${date}T00:00:00`).getTime()) ? date : null;
  const monthStart = new Date(year, monthIndex, 1);
  const nextMonthStart = new Date(year, monthIndex + 1, 1);
  const events = await getVillageCalendarEvents({ villageId: village.id, startsAt: monthStart, endsBefore: nextMonthStart, publicOnly: true });
  const prevMonth = new Date(year, monthIndex - 1, 1);
  const nextMonth = new Date(year, monthIndex + 1, 1);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">ปฏิทินกิจกรรม</h1>
          <p className="mt-1 text-sm text-gray-500">กิจกรรมสาธารณะของ {village.name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={`/${villageSlug}/calendar?month=${toMonthKey(prevMonth)}`} aria-label="เดือนก่อนหน้า" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <p className="hidden min-w-28 text-center text-sm font-medium text-gray-800 sm:block">{monthStart.toLocaleDateString("th-TH", { month: "long", year: "numeric" })}</p>
          <Link href={`/${villageSlug}/calendar?month=${toMonthKey(nextMonth)}`} aria-label="เดือนถัดไป" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <ResidentCalendarGrid
        key={`${expectedMonth}-${initialDate ?? "none"}`}
        year={year}
        monthIndex={monthIndex}
        todayKey={toDateKey(new Date())}
        initialDate={initialDate}
        showAppointments={false}
        eventHrefBase={`/${villageSlug}/calendar`}
        events={events.map((event) => ({ id: event.id, title: event.title, startsAt: event.startsAt.toISOString(), endsAt: event.endsAt?.toISOString() ?? null, location: event.location, isPublic: event.isPublic }))}
        appointments={[]}
      />
    </div>
  );
}
