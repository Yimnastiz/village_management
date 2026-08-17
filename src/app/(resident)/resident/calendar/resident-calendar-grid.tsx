"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

type EventItem = { id: string; title: string; startsAt: string; endsAt: string | null; location: string | null; isPublic: boolean };
type AppointmentItem = { id: string; title: string; stage: string; date: string; startTime: string | null; endTime: string | null };

export function ResidentCalendarGrid({ year, monthIndex, todayKey, initialDate, showAppointments, events, appointments, eventHrefBase = "/resident/calendar" }: { year: number; monthIndex: number; todayKey: string; initialDate: string | null; showAppointments: boolean; events: EventItem[]; appointments: AppointmentItem[]; eventHrefBase?: string }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);
  const eventsByDate = new Map<string, EventItem[]>();
  const appointmentsByDate = new Map<string, AppointmentItem[]>();
  for (const item of events) { const key = item.startsAt.slice(0, 10); eventsByDate.set(key, [...(eventsByDate.get(key) ?? []), item]); }
  if (showAppointments) for (const item of appointments) appointmentsByDate.set(item.date, [...(appointmentsByDate.get(item.date) ?? []), item]);
  const dateKey = (day: number) => String(year) + "-" + String(monthIndex + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const blanks = new Date(year, monthIndex, 1).getDay();
  const selectedEvents = selectedDate ? eventsByDate.get(selectedDate) ?? [] : [];
  const selectedAppointments = selectedDate ? appointmentsByDate.get(selectedDate) ?? [] : [];
  return <>
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white"><div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">{["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map(d => <div key={d} className="px-1 py-2 text-center text-xs font-semibold text-gray-600">{d}</div>)}</div><div className="grid grid-cols-7">
      {Array.from({ length: blanks }).map((_, i) => <div key={"blank-" + i} className="min-h-16 border-b border-r border-gray-100 bg-gray-50/60 sm:min-h-28 lg:min-h-32" />)}
      {Array.from({ length: days }).map((_, index) => { const day = index + 1, date = dateKey(day), dayEvents = eventsByDate.get(date) ?? [], dayAppointments = showAppointments ? appointmentsByDate.get(date) ?? [] : [], selected = selectedDate === date, today = todayKey === date; return <div key={date} className={"relative min-h-16 border-b border-r border-gray-100 sm:min-h-28 lg:min-h-32 " + (selected ? "bg-green-600 text-white" : today ? "bg-rose-50/70 ring-2 ring-inset ring-rose-300" : "bg-white")}><button type="button" aria-pressed={selected} aria-label={"เลือกวันที่ " + day} onClick={() => setSelectedDate(selected ? null : date)} className="absolute inset-0 rounded-none p-0 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-green-700" /><span className={"pointer-events-none absolute left-2 top-2 z-10 text-sm font-semibold " + (today ? "rounded-full bg-rose-600 px-1 text-white" : selected ? "text-white" : "text-gray-800")}>{day}</span><div className="pointer-events-none relative z-10 hidden space-y-1.5 px-2 pt-11 sm:block">{dayAppointments.length ? <p className="flex min-h-7 items-center justify-between rounded-md bg-sky-50 px-2 py-1 text-xs text-sky-800"><span>นัดหมาย</span><span>{dayAppointments.length}</span></p> : null}{dayEvents.length ? <Link href={eventHrefBase + "/" + dayEvents[0].id} onClick={e => e.stopPropagation()} className={"pointer-events-auto flex min-h-7 items-center justify-between rounded-md px-2 py-1 text-xs " + (selected ? "bg-white/15 text-white" : "bg-green-50 text-green-800")}><span>กิจกรรมหมู่บ้าน</span><span>{dayEvents.length}</span></Link> : null}</div></div>; })}
    </div></section>
    {selectedDate ? <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"><div className="flex items-center justify-between gap-2"><h2 className="text-base font-semibold sm:text-lg">รายละเอียดวันที่เลือก: {new Date(selectedDate + "T00:00:00").toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h2><Badge variant="outline">{selectedEvents.length + selectedAppointments.length} รายการ</Badge></div>{!selectedEvents.length && !selectedAppointments.length ? <p className="text-sm text-gray-500">{showAppointments ? "ไม่มีกิจกรรมหรือนัดหมายในวันนี้" : "ไม่มีกิจกรรมในวันนี้"}</p> : <div className="space-y-3">{showAppointments && selectedAppointments.map(item => <Link key={item.id} href={"/resident/appointments/" + item.id} className="block min-h-11 rounded-lg border border-sky-200 px-4 py-3 hover:bg-sky-50"><p className="font-medium">{item.title}</p><p className="mt-1 text-sm text-gray-500">{item.startTime ?? "ทั้งวัน"}{item.endTime ? " - " + item.endTime : ""}</p></Link>)}{selectedEvents.map(item => <Link key={item.id} href={eventHrefBase + "/" + item.id} className="block min-h-11 rounded-lg border border-green-200 px-4 py-3 hover:bg-green-50"><p className="font-medium">{item.title}</p><p className="mt-1 text-sm text-gray-500">{new Date(item.startsAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</p></Link>)}</div>}</section> : null}
  </>;
}
