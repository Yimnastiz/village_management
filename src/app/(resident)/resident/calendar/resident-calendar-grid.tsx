"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";

type EventItem = { id: string; title: string; startsAt: string; endsAt: string | null; location: string | null; isPublic: boolean };
type AppointmentItem = { id: string; title: string; stage: string; date: string; startTime: string | null; endTime: string | null };

export function ResidentCalendarGrid({ year, monthIndex, todayKey, events, appointments }: {
  year: number; monthIndex: number; todayKey: string; events: EventItem[]; appointments: AppointmentItem[];
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const detailsRef = useRef<HTMLElement>(null);
  const eventsByDate = new Map<string, EventItem[]>();
  const appointmentsByDate = new Map<string, AppointmentItem[]>();
  for (const item of events) eventsByDate.set(item.startsAt.slice(0, 10), [...(eventsByDate.get(item.startsAt.slice(0, 10)) ?? []), item]);
  for (const item of appointments) appointmentsByDate.set(item.date, [...(appointmentsByDate.get(item.date) ?? []), item]);
  const key = (day: number) => `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const selectDate = (date: string) => {
    const same = selectedDate === date;
    setSelectedDate(same ? null : date);
    if (!same) requestAnimationFrame(() => {
      const el = detailsRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const blanks = new Date(year, monthIndex, 1).getDay();
  const selectedEvents = selectedDate ? eventsByDate.get(selectedDate) ?? [] : [];
  const selectedAppointments = selectedDate ? appointmentsByDate.get(selectedDate) ?? [] : [];
  return <>
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">{["อา","จ","อ","พ","พฤ","ศ","ส"].map(d => <div key={d} className="px-1 py-2 text-center text-xs font-semibold text-gray-600">{d}</div>)}</div>
      <div className="grid grid-cols-7">
        {Array.from({ length: blanks }).map((_, i) => <div key={`blank-${i}`} className="min-h-16 border-b border-r border-gray-100 bg-gray-50/60 sm:min-h-24 lg:min-h-28" />)}
        {Array.from({ length: days }).map((_, index) => {
          const day = index + 1, date = key(day), dayEvents = eventsByDate.get(date) ?? [], dayAppointments = appointmentsByDate.get(date) ?? [];
          const selected = selectedDate === date, today = todayKey === date;
          const summaryClass = selected ? "bg-white/80 text-green-800" : "bg-green-50 text-green-800";
          return <button key={date} type="button" onClick={() => selectDate(date)} aria-pressed={selected} aria-label={`เลือกวันที่ ${day}`}
            className={`relative min-h-16 min-w-0 border-b border-r border-gray-100 p-1 text-left transition-colors focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-600 sm:min-h-24 sm:p-2 lg:min-h-28 ${selected ? "bg-green-100" : "bg-white hover:bg-gray-50"} ${today ? "ring-1 ring-inset ring-rose-400" : ""}`}>
            <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold sm:text-sm ${today ? "bg-rose-600 text-white" : "text-gray-800"}`}>{day}</span>
            <div className="mt-1 space-y-1">
              {dayAppointments.length > 0 && <span className={`flex max-w-full items-center justify-between gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-medium leading-4 sm:text-xs ${summaryClass}`}><span className="truncate">นัดหมายของคุณ</span><span>{dayAppointments.length}</span></span>}
              {dayEvents.length > 0 && <span className={`flex max-w-full items-center justify-between gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-medium leading-4 sm:text-xs ${summaryClass}`}><span className="truncate">กิจกรรมหมู่บ้าน</span><span>{dayEvents.length}</span></span>}
            </div>
          </button>;
        })}
      </div>
    </section>
    {selectedDate && <section ref={detailsRef} className="scroll-mt-28 space-y-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold text-gray-900 sm:text-lg">รายละเอียดวันที่เลือก: {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h2><Badge variant="outline">{selectedEvents.length + selectedAppointments.length} รายการ</Badge></div>
      {!selectedEvents.length && !selectedAppointments.length ? <p className="text-sm text-gray-500">ไม่มีกิจกรรมหรือนัดหมายในวันนี้</p> : <div className="space-y-5">
        {selectedAppointments.length > 0 && <DetailGroup title="นัดหมายของคุณ">{selectedAppointments.map(item => <Link key={item.id} href={`/resident/appointments/${item.id}`} className="block min-h-11 rounded-lg border border-gray-200 px-4 py-3 hover:border-green-300 hover:bg-green-50"><p className="font-medium text-gray-900">{item.title}</p><p className="mt-1 text-sm text-gray-500">{item.startTime ?? "ทั้งวัน"}{item.endTime ? ` - ${item.endTime}` : ""}</p></Link>)}</DetailGroup>}
        {selectedEvents.length > 0 && <DetailGroup title="กิจกรรมหมู่บ้าน">{selectedEvents.map(item => <Link key={item.id} href={`/resident/calendar/${item.id}`} className="block min-h-11 rounded-lg border border-gray-200 px-4 py-3 hover:border-green-300 hover:bg-green-50"><p className="font-medium text-gray-900">{item.title}</p><p className="mt-1 text-sm text-gray-500">{new Date(item.startsAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}{item.location ? ` · ${item.location}` : ""}</p></Link>)}</DetailGroup>}
      </div>}
    </section>}
  </>;
}
function DetailGroup({ title, children }: { title: string; children: React.ReactNode }) { return <div className="space-y-3"><h3 className="text-sm font-semibold text-gray-800">{title}</h3><div className="space-y-2">{children}</div></div>; }
