"use client";

import Link from "next/link";
import { Clock, Globe2, MapPin, Users } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarSearchSummary, type CalendarSearchResult } from "@/components/calendar/calendar-search-summary";
import { formatThaiMonthYear, toDateKey } from "@/lib/calendar-month";
import { expandCalendarEventOccurrences } from "@/lib/calendar-event-occurrence";

type EventItem = { id: string; title: string; startsAt: string; endsAt: string | null; location: string | null; isPublic: boolean };
type AppointmentItem = { id: string; title: string; scheduledAt: string; userName: string };

function timeLabel(value: string) { return new Date(value).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }); }

function eventTimeLabel(item: EventItem) {
  if (!item.endsAt) return timeLabel(item.startsAt);
  const startsAt = new Date(item.startsAt), endsAt = new Date(item.endsAt);
  if (toDateKey(startsAt) === toDateKey(endsAt)) return `${timeLabel(item.startsAt)} - ${timeLabel(item.endsAt)}`;
  const format = (date: Date) => date.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return `${format(startsAt)} - ${format(endsAt)}`;
}

function CalendarItemRow({ title, remaining, tone, href, continues = false }: { title: string; remaining: number; tone: "appointment" | "event"; href: string; continues?: boolean }) {
  const colors = tone === "appointment" ? "bg-sky-50 text-sky-900 hover:bg-sky-100" : "bg-green-50 text-green-900 hover:bg-green-100";
  return <Link href={href} onClick={(event) => event.stopPropagation()} className={`pointer-events-auto flex min-h-7 items-center gap-1 rounded-md px-2 py-1 text-xs ${colors}`}><span className="min-w-0 flex-1 truncate">{continues ? "ต่อเนื่อง · " : ""}{title}</span>{remaining > 0 ? <span className="shrink-0 font-medium">+{remaining}</span> : null}</Link>;
}

export function AdminCalendarGrid({ year, monthIndex, todayKey, initialDate, searchKeyword, activeType, events, appointments, stickyWeekdays = false }: { year: number; monthIndex: number; todayKey: string; initialDate: string | null; searchKeyword: string; activeType: "ALL" | "EVENT" | "APPOINTMENT"; events: EventItem[]; appointments: AppointmentItem[]; stickyWeekdays?: boolean }) {
  const router = useRouter(), pathname = usePathname(), searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const detailRef = useRef<HTMLElement>(null), shouldScrollRef = useRef(false);
  const visibleEvents = activeType === "APPOINTMENT" ? [] : events;
  const visibleAppointments = activeType === "EVENT" ? [] : appointments;
  const eventsByDate = expandCalendarEventOccurrences(visibleEvents), appointmentsByDate = new Map<string, AppointmentItem[]>();
  for (const item of visibleAppointments) { const key = toDateKey(new Date(item.scheduledAt)); appointmentsByDate.set(key, [...(appointmentsByDate.get(key) ?? []), item]); }
  const selectDate = (date: string, forceSelect = false) => {
    const nextDate = !forceSelect && selectedDate === date ? null : date;
    shouldScrollRef.current = Boolean(nextDate && ((eventsByDate.get(date)?.length ?? 0) + (appointmentsByDate.get(date)?.length ?? 0)));
    setSelectedDate(nextDate);
    const params = new URLSearchParams(searchParams.toString()); if (nextDate) params.set("date", nextDate); else params.delete("date");
    const query = params.toString(); router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  useEffect(() => { if (!shouldScrollRef.current || !detailRef.current) return; shouldScrollRef.current = false; const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" })); }, [selectedDate]);
  const dateKey = (day: number) => `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const days = new Date(year, monthIndex + 1, 0).getDate(), blanks = new Date(year, monthIndex, 1).getDay();
  const selectedEvents = selectedDate ? eventsByDate.get(selectedDate) ?? [] : [], selectedAppointments = selectedDate ? appointmentsByDate.get(selectedDate) ?? [] : [];
  const totalSelected = selectedEvents.length + selectedAppointments.length;
  const firstMonthDate = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  const searchResults: CalendarSearchResult[] = [
    ...visibleEvents.map((item) => {
      const startDate = toDateKey(new Date(item.startsAt));
      return { id: item.id, type: "event" as const, title: item.title, date: startDate, selectionDate: startDate < firstMonthDate ? firstMonthDate : startDate };
    }),
    ...visibleAppointments.map((item) => ({ id: item.id, type: "appointment" as const, title: item.title, date: toDateKey(new Date(item.scheduledAt)) })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "th"));
  return <>
    <CalendarSearchSummary query={searchKeyword} monthLabel={formatThaiMonthYear(year, monthIndex)} results={searchResults} emptyMessage={`ไม่พบกิจกรรมหรือนัดหมายที่ตรงกับ “${searchKeyword}” ในเดือนนี้`} onSelectDate={(date) => selectDate(date, true)} />
    <section className={stickyWeekdays ? "overflow-visible rounded-xl border border-gray-200 bg-white" : "overflow-hidden rounded-xl border border-gray-200 bg-white"}>
      <div className={stickyWeekdays ? "sticky top-[calc(var(--app-sticky-top)+var(--calendar-toolbar-height,0px))] z-20 grid grid-cols-7 border-b border-gray-200 bg-white shadow-sm" : "grid grid-cols-7 border-b border-gray-200 bg-gray-50"}>{["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((day) => <div key={day} className="px-1 py-2 text-center text-xs font-semibold text-gray-600">{day}</div>)}</div>
      <div className="grid grid-cols-7">{Array.from({ length: blanks }).map((_, index) => <div key={`blank-${index}`} className="min-h-16 border-b border-r border-gray-100 bg-gray-50/60 sm:min-h-28 lg:min-h-32" />)}{Array.from({ length: days }).map((_, index) => { const day = index + 1, date = dateKey(day), dayEvents = eventsByDate.get(date) ?? [], dayAppointments = appointmentsByDate.get(date) ?? [], selected = selectedDate === date, today = todayKey === date; return <div key={date} className={`relative min-h-16 border-b border-r border-gray-100 sm:min-h-28 lg:min-h-32 ${selected ? "bg-green-50/70 ring-1 ring-inset ring-green-300" : "bg-white hover:bg-gray-50/80"} ${today && !selected ? "ring-1 ring-inset ring-rose-300" : ""}`}><button type="button" aria-pressed={selected} aria-current={selected ? "date" : undefined} aria-label={`เลือกวันที่ ${day}`} onClick={() => selectDate(date)} className="absolute inset-0 rounded-none focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-700" /><div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex items-center justify-between gap-1"><span className={`text-sm font-semibold ${today ? "text-rose-600" : "text-gray-800"}`}>{day}</span>{today ? <span className="rounded px-1 text-[10px] font-medium text-rose-700 sm:text-xs">วันนี้</span> : null}</div><div className="pointer-events-none relative z-10 hidden space-y-1.5 px-2 pt-10 sm:block">{dayAppointments.length ? <CalendarItemRow title={dayAppointments[0].title} remaining={dayAppointments.length - 1} tone="appointment" href={`/admin/appointments/${dayAppointments[0].id}`} /> : null}{dayEvents.length ? <CalendarItemRow title={dayEvents[0].event.title} remaining={dayEvents.length - 1} tone="event" href={`/admin/calendar/${dayEvents[0].event.id}`} continues={dayEvents[0].continuesFromPreviousDay} /> : null}</div>{dayAppointments.length + dayEvents.length ? <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 sm:hidden">{dayAppointments.length ? <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> : null}{dayEvents.length ? <span className="h-1.5 w-1.5 rounded-full bg-green-600" /> : null}</div> : null}</div>; })}</div>
      <div className="border-t border-gray-200 bg-gray-50 px-3 py-2"><span className="inline-flex items-center gap-3 text-xs text-gray-600">{activeType !== "EVENT" ? <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" />นัดหมาย</span> : null}{activeType !== "APPOINTMENT" ? <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-600" />กิจกรรม</span> : null}<span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" />วันนี้</span></span></div>
    </section>
    {selectedDate ? <section ref={detailRef} className="scroll-mt-[calc(var(--app-sticky-top)+var(--calendar-toolbar-height,0px)+var(--calendar-weekday-height,2.25rem)+1rem)] rounded-xl border border-gray-200 bg-white p-4 sm:p-6"><div className="flex items-start justify-between gap-3"><h2 className="text-base font-semibold text-gray-900 sm:text-lg">รายละเอียดวันที่เลือก: {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h2><span className="shrink-0 pt-0.5 text-sm text-gray-500">{totalSelected} รายการ</span></div>{!totalSelected ? <p className="mt-5 text-sm text-gray-500">{activeType === "EVENT" ? "ไม่มีกิจกรรมในวันนี้" : activeType === "APPOINTMENT" ? "ไม่มีนัดหมายในวันนี้" : "ไม่มีกิจกรรมหรือนัดหมายในวันนี้"}</p> : <div className="mt-5 space-y-5">{activeType !== "EVENT" && selectedAppointments.length ? <section><h3 className="text-sm font-semibold text-gray-800">นัดหมาย ({selectedAppointments.length})</h3><div className="mt-2 divide-y divide-gray-100 border-y border-gray-100">{selectedAppointments.map((item) => <Link key={item.id} href={`/admin/appointments/${item.id}`} className="block py-3 hover:bg-gray-50"><p className="font-medium text-gray-900">{item.title}</p><p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500"><Clock className="h-4 w-4" aria-hidden="true" />{timeLabel(item.scheduledAt)} · {item.userName}</p></Link>)}</div></section> : null}{activeType !== "APPOINTMENT" && selectedEvents.length ? <section className={selectedAppointments.length ? "border-t border-gray-100 pt-5" : ""}><h3 className="text-sm font-semibold text-gray-800">กิจกรรม ({selectedEvents.length})</h3><div className="mt-2 divide-y divide-gray-100 border-y border-gray-100">{selectedEvents.map(({ event: item }) => <Link key={item.id} href={`/admin/calendar/${item.id}`} className="block py-3 hover:bg-gray-50"><p className="font-medium text-gray-900">{item.title}</p><div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-500">{item.isPublic ? <span className="inline-flex items-center gap-1"><Globe2 className="h-3.5 w-3.5" aria-hidden="true" />สาธารณะ</span> : <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" />เฉพาะสมาชิก</span>}<span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{eventTimeLabel(item)}</span></div>{item.location ? <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500"><MapPin className="h-4 w-4" aria-hidden="true" />{item.location}</p> : null}</Link>)}</div></section> : null}</div>}</section> : null}
  </>;
}

