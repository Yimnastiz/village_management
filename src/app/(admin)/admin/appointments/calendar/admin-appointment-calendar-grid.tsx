"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type AppointmentItem = {
  id: string;
  title: string;
  residentName: string;
  date: string;
  time: string | null;
  sortTime: string | null;
};

type Props = {
  year: number;
  monthIndex: number;
  todayKey: string;
  initialDate: string | null;
  appointments: AppointmentItem[];
};

const weekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function sortAppointments(items: AppointmentItem[]) {
  return [...items].sort((a, b) => {
    if (a.sortTime && b.sortTime) return a.sortTime.localeCompare(b.sortTime);
    if (a.sortTime) return -1;
    if (b.sortTime) return 1;
    return a.id.localeCompare(b.id);
  });
}

export function AdminAppointmentCalendarGrid({ year, monthIndex, todayKey, initialDate, appointments }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const appointmentsByDate = new Map<string, AppointmentItem[]>();
  for (const appointment of appointments) {
    appointmentsByDate.set(appointment.date, [...(appointmentsByDate.get(appointment.date) ?? []), appointment]);
  }
  for (const [date, items] of appointmentsByDate) appointmentsByDate.set(date, sortAppointments(items));

  const selectDate = (date: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (initialDate === date) params.delete("date");
    else params.set("date", date);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const dateKey = (day: number) => `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingBlankDays = new Date(year, monthIndex, 1).getDay();
  const selectedAppointments = initialDate ? appointmentsByDate.get(initialDate) ?? [] : [];

  return <>
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {weekdays.map((day) => <div key={day} className="px-1 py-2 text-center text-xs font-semibold text-gray-600">{day}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: leadingBlankDays }).map((_, index) => <div key={`blank-${index}`} className="min-h-16 border-b border-r border-gray-100 bg-gray-50/60 sm:min-h-28 lg:min-h-32" />)}
        {Array.from({ length: daysInMonth }).map((_, index) => {
          const day = index + 1;
          const date = dateKey(day);
          const dayAppointments = appointmentsByDate.get(date) ?? [];
          const selected = initialDate === date;
          const today = todayKey === date;
          const cellDate = new Date(year, monthIndex, day);

          return <div key={date} className={`relative min-h-16 min-w-0 border-b border-r border-gray-100 sm:min-h-28 lg:min-h-32 ${selected ? "bg-blue-50/70" : "bg-white"} ${today ? "ring-1 ring-inset ring-rose-300" : selected ? "ring-1 ring-inset ring-blue-300" : ""}`}>
            <button
              type="button"
              aria-pressed={selected}
              aria-label={`เลือกวันที่ ${cellDate.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}
              onClick={() => selectDate(date)}
              className="absolute inset-0 z-0 rounded-none focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-700"
            />
            <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex items-center justify-between gap-1">
              <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm font-semibold ${today ? "bg-red-600 text-white" : "text-gray-800"}`}>{day}</span>
              {dayAppointments.length ? <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 px-1 text-xs font-medium text-blue-700">{dayAppointments.length}</span> : null}
            </div>
            <div className="pointer-events-none relative z-10 hidden space-y-1 px-2 pt-10 sm:block">
              {dayAppointments.slice(0, 2).map((appointment) => (
                <Link key={appointment.id} href={`/admin/appointments/${appointment.id}`} onClick={(event) => event.stopPropagation()} className="pointer-events-auto block truncate rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-800 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700">
                  <div className="truncate font-medium">{appointment.time ? `${appointment.time} ` : ""}นัดกับ {appointment.residentName}</div>
                  <div className="truncate text-blue-600">{appointment.title}</div>
                </Link>
              ))}
              {dayAppointments.length > 2 ? <span className="block text-xs text-gray-500">+ อีก {dayAppointments.length - 2} รายการ</span> : null}
            </div>
            {dayAppointments.length ? <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1 sm:hidden"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" /><span className="sr-only">มีนัดหมาย {dayAppointments.length} รายการ</span></div> : null}
          </div>;
        })}
      </div>
      <div className="border-t border-gray-200 bg-gray-50 px-3 py-2"><span className="inline-flex items-center gap-1 text-xs text-gray-600"><span className="h-2 w-2 rounded-full bg-red-500" />วันนี้</span></div>
    </section>

    {initialDate ? <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-900 sm:text-lg">นัดหมายในวัน{new Date(`${initialDate}T00:00:00`).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h2>
        <span className="text-sm text-gray-500">{selectedAppointments.length} รายการ</span>
      </div>
      {selectedAppointments.length ? <div className="mt-4 space-y-2">
        {selectedAppointments.map((appointment) => <Link key={appointment.id} href={`/admin/appointments/${appointment.id}`} className="block rounded-lg border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700">
          <p className="font-medium text-gray-900">{appointment.time ? `${appointment.time} ` : ""}นัดกับ {appointment.residentName}</p>
          <p className="text-sm text-gray-600">เรื่อง: {appointment.title}</p>
        </Link>)}
      </div> : <p className="mt-4 text-sm text-gray-500">ไม่พบรายการนัดหมายในวันนี้</p>}
    </section> : null}
  </>;
}
