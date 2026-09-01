"use client";

import { CalendarPlus, Clock, MapPin } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SuperAdminCalendarEventActions } from "./superadmin-calendar-event-actions";

export type SuperAdminCalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
  createdBySuperAdmin: boolean;
};

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

export function SuperAdminCalendarGrid({ villageId, year, monthIndex, todayKey, initialDate, events }: { villageId: string; year: number; monthIndex: number; todayKey: string; initialDate: string | null; events: SuperAdminCalendarEvent[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const detailRef = useRef<HTMLElement>(null);
  const scrollDetailRef = useRef(false);
  const eventsByDate = new Map<string, SuperAdminCalendarEvent[]>();
  for (const event of events) {
    const key = event.startsAt.slice(0, 10);
    eventsByDate.set(key, [...(eventsByDate.get(key) ?? []), event]);
  }
  for (const items of eventsByDate.values()) items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const selectDate = (date: string) => {
    const nextDate = selectedDate === date ? null : date;
    scrollDetailRef.current = Boolean(nextDate && (eventsByDate.get(date)?.length ?? 0));
    setSelectedDate(nextDate);
    const params = new URLSearchParams(searchParams.toString());
    if (nextDate) params.set("date", nextDate); else params.delete("date");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (!scrollDetailRef.current || !detailRef.current) return;
    scrollDetailRef.current = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: "start", behavior: reducedMotion ? "auto" : "smooth" }));
  }, [selectedDate]);

  const dateKey = (day: number) => `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const blanks = new Date(year, monthIndex, 1).getDay();
  const selectedEvents = selectedDate ? eventsByDate.get(selectedDate) ?? [] : [];

  return <>
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">{["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((day) => <div key={day} className="px-1 py-2 text-center text-xs font-semibold text-gray-600">{day}</div>)}</div>
      <div className="grid grid-cols-7">
        {Array.from({ length: blanks }).map((_, index) => <div key={`blank-${index}`} className="min-h-16 border-b border-r border-gray-100 bg-gray-50/60 sm:min-h-28 lg:min-h-32" />)}
        {Array.from({ length: days }).map((_, index) => {
          const day = index + 1;
          const date = dateKey(day);
          const dayEvents = eventsByDate.get(date) ?? [];
          const selected = selectedDate === date;
          const today = todayKey === date;
          return <div key={date} className={`relative min-h-16 min-w-0 border-b border-r border-gray-100 p-1 sm:min-h-28 sm:p-2 lg:min-h-32 ${selected ? "z-10 bg-cyan-50 ring-2 ring-inset ring-cyan-600" : "bg-white hover:bg-gray-50/80"} ${today && !selected ? "bg-red-50 ring-2 ring-inset ring-red-300" : ""}`}>
            <button type="button" aria-pressed={selected} aria-current={selected ? "date" : undefined} aria-label={`เลือกวันที่ ${day}`} onClick={() => selectDate(date)} className="absolute inset-0 z-0 rounded-none focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-700" />
            <div className="pointer-events-none relative z-10"><div className="mb-2 flex min-w-0 items-center justify-between gap-1"><span className={`text-sm font-semibold ${selected ? "text-cyan-900" : today ? "text-red-600" : "text-gray-800"}`}>{day}</span>{dayEvents.length ? <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-medium ${selected ? "bg-cyan-700 text-white" : "bg-cyan-100 text-cyan-800"}`}>{dayEvents.length}</span> : null}</div>
              <div className="space-y-1.5">{dayEvents.length ? <button type="button" onClick={() => selectDate(date)} className="pointer-events-auto relative z-20 hidden w-full truncate rounded-md bg-cyan-100 px-2 py-1 text-left text-xs text-cyan-900 hover:bg-cyan-200 sm:block">{dayEvents[0].title}</button> : null}{dayEvents.length > 1 ? <button type="button" onClick={() => selectDate(date)} className="pointer-events-auto relative z-20 hidden text-xs text-gray-600 hover:text-gray-900 sm:block">+ อีก {dayEvents.length - 1} รายการ</button> : null}</div>
            </div>
          </div>;
        })}
      </div>
      <div className="border-t border-gray-200 bg-gray-50 px-3 py-2"><span className="inline-flex items-center gap-1 text-xs text-gray-600"><span className="h-2 w-2 rounded-full bg-red-500" />วันนี้</span></div>
    </section>
    {selectedDate ? <section ref={detailRef} className="scroll-mt-[calc(var(--app-sticky-top)+5rem)] space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="text-base font-semibold text-gray-900 sm:text-lg">รายละเอียดวันที่เลือก: {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h2><span className="shrink-0 pt-0.5 text-sm text-gray-500">{selectedEvents.length} รายการ</span></div>
      {!selectedEvents.length ? <div className="py-5 text-center text-sm text-gray-500"><CalendarPlus className="mx-auto mb-2 h-8 w-8 text-gray-300" />ไม่มีกิจกรรมในวันนี้</div> : <div className="space-y-3">{selectedEvents.map((event) => <article key={event.id} className="rounded-lg border border-gray-100 p-3 sm:p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words font-semibold text-gray-900">{event.title}</h3><Badge variant={event.isPublic ? "success" : "info"}>{event.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}</Badge></div>{event.description ? <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-600">{event.description}</p> : null}<dl className="mt-3 grid gap-2 text-sm text-gray-600 sm:grid-cols-2"><div className="flex min-w-0 items-start gap-1.5"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" /><div><dt className="sr-only">เวลา</dt><dd>{timeLabel(event.startsAt)}{event.endsAt ? ` - ${timeLabel(event.endsAt)}` : ""}</dd></div></div>{event.location ? <div className="flex min-w-0 items-start gap-1.5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" /><div><dt className="sr-only">สถานที่</dt><dd className="break-words">{event.location}</dd></div></div> : null}<div><dt className="inline text-gray-500">สร้างเมื่อ: </dt><dd className="inline">{new Date(event.createdAt).toLocaleString("th-TH")}</dd></div><div><dt className="inline text-gray-500">แก้ไขล่าสุด: </dt><dd className="inline">{new Date(event.updatedAt).toLocaleString("th-TH")}</dd></div><div><dt className="inline text-gray-500">ผู้สร้าง: </dt><dd className="inline">{event.createdByName ?? (event.createdBySuperAdmin ? "ผู้ดูแลระบบระดับสูง" : "ไม่ระบุ")}</dd></div></dl></div><div className="shrink-0"><SuperAdminCalendarEventActions villageId={villageId} event={event} /></div></div></article>)}</div>}
    </section> : null}
  </>;
}
