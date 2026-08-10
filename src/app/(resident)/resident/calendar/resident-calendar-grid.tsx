"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";

type EventItem = { id: string; title: string; startsAt: string; endsAt: string | null; location: string | null; isPublic: boolean };
type AppointmentItem = { id: string; title: string; stage: string; date: string; startTime: string | null; endTime: string | null };

export function ResidentCalendarGrid({ year, monthIndex, todayKey, initialDate, showAppointments, events, appointments }: {
  year: number; monthIndex: number; todayKey: string; initialDate: string | null; showAppointments: boolean; events: EventItem[]; appointments: AppointmentItem[];
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);
  const detailsRef = useRef<HTMLElement>(null);
  const scrollDetailsIntoViewIfNeeded = () => {
    const details = detailsRef.current;
    if (!details) return;
    const rect = details.getBoundingClientRect();
    const isInView = rect.top >= 112 && rect.bottom <= window.innerHeight;
    if (!isInView) details.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  useEffect(() => {
    if (!initialDate) return;
    requestAnimationFrame(scrollDetailsIntoViewIfNeeded);
  }, [initialDate]);
  const eventsByDate = new Map<string, EventItem[]>();
  const appointmentsByDate = new Map<string, AppointmentItem[]>();
  for (const item of events) { const date = item.startsAt.slice(0, 10); eventsByDate.set(date, [...(eventsByDate.get(date) ?? []), item]); }
  if (showAppointments) for (const item of appointments) appointmentsByDate.set(item.date, [...(appointmentsByDate.get(item.date) ?? []), item]);
  const dateKey = (day: number) => `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const selectDate = (date: string) => {
    const same = selectedDate === date;
    setSelectedDate(same ? null : date);
    if (!same) requestAnimationFrame(scrollDetailsIntoViewIfNeeded);
  };
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const blanks = new Date(year, monthIndex, 1).getDay();
  const selectedEvents = selectedDate ? eventsByDate.get(selectedDate) ?? [] : [];
  const selectedAppointments = selectedDate ? appointmentsByDate.get(selectedDate) ?? [] : [];
  return <>
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">{["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map(d => <div key={d} className="px-1 py-2 text-center text-xs font-semibold text-gray-600">{d}</div>)}</div>
      <div className="grid grid-cols-7">
        {Array.from({ length: blanks }).map((_, i) => <div key={`blank-${i}`} className="min-h-16 border-b border-r border-gray-100 bg-gray-50/60 sm:min-h-28 lg:min-h-32" />)}
        {Array.from({ length: days }).map((_, index) => {
          const day = index + 1, date = dateKey(day), dayEvents = eventsByDate.get(date) ?? [], dayAppointments = showAppointments ? appointmentsByDate.get(date) ?? [] : [];
          const selected = selectedDate === date, today = todayKey === date;
          return <button key={date} type="button" onClick={() => selectDate(date)} aria-pressed={selected} aria-label={`เลือกวันที่ ${day}`}
            className={`relative min-h-16 min-w-0 border-b border-r border-gray-100 p-0 text-left transition-colors focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-700 sm:min-h-28 lg:min-h-32 ${selected ? "bg-green-600 text-white hover:bg-green-700" : "bg-white hover:bg-gray-50"}`}>
            <span className={`absolute left-1.5 top-1.5 inline-flex items-center justify-center rounded-full text-sm font-semibold sm:left-2 sm:top-2 sm:h-6 sm:min-w-6 sm:px-1 ${today ? "h-5 min-w-5 bg-rose-600 px-0.5 text-white" : selected ? "text-white" : "text-gray-800"}`}>{day}</span>
            <div className="absolute right-1.5 top-1.5 sm:right-2 sm:top-2">
              {dayEvents.length + dayAppointments.length > 0 ? <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold sm:hidden ${selected ? "bg-white/20 text-white" : "bg-green-100 text-green-800"}`}>{dayEvents.length + dayAppointments.length}</span> : null}
            </div>
            {today ? <span className={`absolute right-1.5 top-7 text-[10px] font-semibold sm:right-2 sm:top-2 sm:text-xs ${selected ? "rounded bg-white/15 px-1 text-white" : "text-rose-600"}`}>วันนี้</span> : null}
            <div className="hidden space-y-1.5 px-2 pt-11 sm:block">
              {dayAppointments.length > 0 ? <p className={`flex min-h-7 w-full items-center justify-between gap-1 rounded-md px-2 py-1 text-xs font-medium leading-5 ${selected ? "bg-white/15 text-white" : "bg-sky-50 text-sky-800"}`}><span className="truncate">นัดหมาย</span><span className="shrink-0 font-semibold">{dayAppointments.length}</span></p> : null}
              {dayEvents.length > 0 ? <p className={`flex min-h-7 w-full items-center justify-between gap-1 rounded-md px-2 py-1 text-xs font-medium leading-5 ${selected ? "bg-white/15 text-white" : "bg-green-50 text-green-800"}`}><span className="truncate">กิจกรรมหมู่บ้าน</span><span className="shrink-0 font-semibold">{dayEvents.length}</span></p> : null}
            </div>
          </button>;
        })}
      </div>
    </section>
    {selectedDate ? <section ref={detailsRef} className="scroll-mt-28 space-y-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold text-gray-900 sm:text-lg">รายละเอียดวันที่เลือก: {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h2><Badge variant="outline">{selectedEvents.length + selectedAppointments.length} รายการ</Badge></div>
      {!selectedEvents.length && !selectedAppointments.length ? <p className="text-sm text-gray-500">{showAppointments ? "ไม่มีกิจกรรมหรือนัดหมายในวันนี้" : "ไม่มีกิจกรรมในวันนี้"}</p> : <div className="space-y-5">
        {showAppointments && selectedAppointments.length ? <DetailGroup type="appointment" title="นัดหมายของคุณ">{selectedAppointments.map(item => <Link key={item.id} href={`/resident/appointments/${item.id}?from=calendar&month=${year}-${String(monthIndex + 1).padStart(2, "0")}&date=${selectedDate}`} className="block min-h-11 rounded-lg border border-sky-200 px-4 py-3 hover:bg-sky-50"><p className="font-medium text-gray-900">{item.title}</p><p className="mt-1 text-sm text-gray-500">{item.startTime ?? "ทั้งวัน"}{item.endTime ? ` - ${item.endTime}` : ""}</p></Link>)}</DetailGroup> : null}
        {selectedEvents.length ? <DetailGroup type="event" title="กิจกรรมหมู่บ้าน">{selectedEvents.map(item => <Link key={item.id} href={`/resident/calendar/${item.id}`} className="block min-h-11 rounded-lg border border-green-200 px-4 py-3 hover:bg-green-50"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-gray-900">{item.title}</p>{!item.isPublic ? <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">เฉพาะลูกบ้าน</span> : null}</div><p className="mt-1 text-sm text-gray-500">{new Date(item.startsAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}{item.location ? ` · ${item.location}` : ""}</p></Link>)}</DetailGroup> : null}
      </div>}
    </section> : null}
  </>;
}

function DetailGroup({ title, type, children }: { title: string; type: "appointment" | "event"; children: React.ReactNode }) {
  const style = type === "appointment" ? "border-sky-200 bg-sky-50 text-sky-800" : "border-green-200 bg-green-50 text-green-800";
  return <div className="space-y-3"><h3><span className={`inline-flex rounded-full border px-2.5 py-1 text-sm font-semibold ${style}`}>{title}</span></h3><div className="space-y-2">{children}</div></div>;
}
