"use client";

import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type EventItem = { id: string; title: string; startsAt: string; endsAt: string | null; location: string | null; isPublic: boolean };
type AppointmentItem = { id: string; title: string; stage: string; date: string; startTime: string | null; endTime: string | null };

const residentStageLabels: Record<string, string> = { PENDING_APPROVAL: "รอผู้ใหญ่บ้านตอบกลับ", TIME_SUGGESTED: "รอคุณยืนยันเวลา", APPROVED: "ยืนยันนัดหมายแล้ว", REJECTED: "ปฏิเสธ", CANCELLED: "ยกเลิก", COMPLETED: "เสร็จสิ้น" };

function timeLabel(startsAt: string) { return new Date(startsAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }); }

function CalendarItemRow({ title, remaining, tone, href }: { title: string; remaining: number; tone: "appointment" | "event"; href: string }) {
  const colors = tone === "appointment" ? "bg-sky-50 text-sky-900 hover:bg-sky-100" : "bg-green-50 text-green-900 hover:bg-green-100";
  return <Link href={href} onClick={(event) => event.stopPropagation()} className={`pointer-events-auto flex min-h-7 items-center gap-1 rounded-md px-2 py-1 text-xs ${colors}`}><span className="min-w-0 flex-1 truncate">{title}</span>{remaining > 0 ? <span className="shrink-0 font-medium">+{remaining}</span> : null}</Link>;
}

export function ResidentCalendarGrid({ year, monthIndex, todayKey, initialDate, showAppointments, searchKeyword = "", itemType = "all", events, appointments, eventHrefBase = "/resident/calendar" }: { year: number; monthIndex: number; todayKey: string; initialDate: string | null; showAppointments: boolean; searchKeyword?: string; itemType?: "all" | "appointment" | "event"; events: EventItem[]; appointments: AppointmentItem[]; eventHrefBase?: string }) {
  const router = useRouter(), pathname = usePathname(), searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);
  const normalizedSearch = searchKeyword.trim().toLocaleLowerCase();
  const matches = (value: string) => !normalizedSearch || value.toLocaleLowerCase().includes(normalizedSearch);
  const visibleEvents = itemType === "appointment" ? [] : events.filter((item) => matches([item.title, item.location ?? ""].join(" ")));
  const visibleAppointments = itemType === "event" ? [] : appointments.filter((item) => matches(item.title));
  const eventsByDate = new Map<string, EventItem[]>(), appointmentsByDate = new Map<string, AppointmentItem[]>();
  for (const item of visibleEvents) { const key = item.startsAt.slice(0, 10); eventsByDate.set(key, [...(eventsByDate.get(key) ?? []), item]); }
  if (showAppointments) for (const item of visibleAppointments) appointmentsByDate.set(item.date, [...(appointmentsByDate.get(item.date) ?? []), item]);
  for (const items of eventsByDate.values()) items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  for (const items of appointmentsByDate.values()) items.sort((a, b) => !a.startTime ? (b.startTime ? 1 : 0) : !b.startTime ? -1 : a.startTime.localeCompare(b.startTime));
  const selectDate = (date: string) => { const nextDate = selectedDate === date ? null : date; setSelectedDate(nextDate); const params = new URLSearchParams(searchParams.toString()); if (nextDate) params.set("date", nextDate); else params.delete("date"); const query = params.toString(); router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }); };
  const dateKey = (day: number) => `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const days = new Date(year, monthIndex + 1, 0).getDate(), blanks = new Date(year, monthIndex, 1).getDay();
  const selectedEvents = selectedDate ? eventsByDate.get(selectedDate) ?? [] : [], selectedAppointments = selectedDate ? appointmentsByDate.get(selectedDate) ?? [] : [];
  const totalSelected = selectedEvents.length + selectedAppointments.length;
  const selectedHadItems = Boolean(selectedDate && ((showAppointments && appointments.some((item) => item.date === selectedDate)) || events.some((item) => item.startsAt.slice(0, 10) === selectedDate)));
  const hasActiveFilter = Boolean(normalizedSearch) || itemType !== "all";
  return <>
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">{["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((day) => <div key={day} className="px-1 py-2 text-center text-xs font-semibold text-gray-600">{day}</div>)}</div>
      <div className="grid grid-cols-7">
        {Array.from({ length: blanks }).map((_, index) => <div key={`blank-${index}`} className="min-h-16 border-b border-r border-gray-100 bg-gray-50/60 sm:min-h-28 lg:min-h-32" />)}
        {Array.from({ length: days }).map((_, index) => {
          const day = index + 1, date = dateKey(day), dayEvents = eventsByDate.get(date) ?? [], dayAppointments = showAppointments ? appointmentsByDate.get(date) ?? [] : [], selected = selectedDate === date, today = todayKey === date, hasItems = dayAppointments.length + dayEvents.length > 0;
          return <div key={date} className={`relative min-h-16 border-b border-r border-gray-100 sm:min-h-28 lg:min-h-32 ${selected ? "bg-green-50/70" : "bg-white"} ${today ? "ring-1 ring-inset ring-rose-300" : selected ? "ring-1 ring-inset ring-green-300" : ""}`}>
            <button type="button" aria-pressed={selected} aria-label={`เลือกวันที่ ${day}`} onClick={() => selectDate(date)} className="absolute inset-0 rounded-none p-0 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-green-700" />
            <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex items-center justify-between gap-1"><span className="text-sm font-semibold text-gray-800">{day}</span>{today ? <span className="rounded px-1 text-[10px] font-medium text-rose-700 sm:text-xs">วันนี้</span> : null}</div>
            <div className="pointer-events-none relative z-10 hidden space-y-1.5 px-2 pt-10 sm:block">{dayAppointments.length ? <CalendarItemRow title={dayAppointments[0].title} remaining={dayAppointments.length - 1} tone="appointment" href={`/resident/appointments/${dayAppointments[0].id}`} /> : null}{dayEvents.length ? <CalendarItemRow title={dayEvents[0].title} remaining={dayEvents.length - 1} tone="event" href={`${eventHrefBase}/${dayEvents[0].id}`} /> : null}</div>
            {hasItems ? <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 sm:hidden" aria-label={`${dayAppointments.length} นัดหมาย, ${dayEvents.length} กิจกรรม`}>{dayAppointments.length ? <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> : null}{dayEvents.length ? <span className="h-1.5 w-1.5 rounded-full bg-green-600" /> : null}</div> : null}
          </div>;
        })}
      </div>
    </section>
    {selectedDate ? <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3"><h2 className="text-base font-semibold text-gray-900 sm:text-lg">รายละเอียดวันที่เลือก: {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h2><span className="shrink-0 pt-0.5 text-sm text-gray-500">{totalSelected} รายการ</span></div>
      {!totalSelected ? <p className="mt-5 text-sm text-gray-500">{hasActiveFilter && selectedHadItems ? "ไม่พบรายการที่ตรงกับการค้นหาหรือตัวกรอง" : showAppointments ? "ไม่มีกิจกรรมหรือนัดหมายในวันนี้" : "ไม่มีกิจกรรมในวันนี้"}</p> : <div className="mt-5 space-y-5">
        {showAppointments && selectedAppointments.length ? <section><h3 className="text-sm font-semibold text-gray-800">นัดหมาย ({selectedAppointments.length})</h3><div className="mt-2 divide-y divide-gray-100 border-y border-gray-100">{selectedAppointments.map((item) => <Link key={item.id} href={`/resident/appointments/${item.id}`} className="block py-3 hover:bg-gray-50"><p className="font-medium text-gray-900">{item.title}</p>{item.startTime ? <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500"><Clock className="h-4 w-4" aria-hidden="true" />{item.startTime}</p> : null}<p className="mt-1 text-sm text-gray-500">{residentStageLabels[item.stage] ?? item.stage}</p></Link>)}</div></section> : null}
        {selectedEvents.length ? <section className={selectedAppointments.length ? "border-t border-gray-100 pt-5" : ""}><h3 className="text-sm font-semibold text-gray-800">กิจกรรม ({selectedEvents.length})</h3><div className="mt-2 divide-y divide-gray-100 border-y border-gray-100">{selectedEvents.map((item) => <Link key={item.id} href={`${eventHrefBase}/${item.id}`} className="block py-3 hover:bg-gray-50"><p className="font-medium text-gray-900">{item.title}</p><p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500"><Clock className="h-4 w-4" aria-hidden="true" />{timeLabel(item.startsAt)}</p>{item.location ? <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500"><MapPin className="h-4 w-4" aria-hidden="true" />{item.location}</p> : null}</Link>)}</div></section> : null}
      </div>}
    </section> : null}
  </>;
}
