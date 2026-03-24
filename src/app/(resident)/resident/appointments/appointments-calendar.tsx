"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppointmentsCalendarProps {
  year: number;
  month: number; // 1–12
  blockedDates: string[]; // "YYYY-MM-DD" strings — headman busy
  userAppointmentDates: string[]; // "YYYY-MM-DD" — resident's own appointments
}

const THAI_DAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const THAI_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
  "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
  "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function AppointmentsCalendar({
  year,
  month,
  blockedDates,
  userAppointmentDates,
}: AppointmentsCalendarProps) {
  const router = useRouter();

  const blocked = new Set(blockedDates);
  const userDates = new Set(userAppointmentDates);

  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay(); // 0 = Sunday

  // Build grid cells: null = empty padding, number = day
  const cells: (number | null)[] = Array<null>(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function goTo(y: number, m: number) {
    router.push(`/resident/appointments?year=${y}&month=${m}`);
  }

  function prev() {
    month === 1 ? goTo(year - 1, 12) : goTo(year, month - 1);
  }

  function next() {
    month === 12 ? goTo(year + 1, 1) : goTo(year, month + 1);
  }

  const currentYear = today.getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 1 + i);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <button
          onClick={prev}
          className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
          aria-label="เดือนก่อนหน้า"
        >
          <ChevronLeft className="h-4 w-4 text-gray-600" />
        </button>

        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <select
            value={month}
            onChange={(e) => goTo(year, Number(e.target.value))}
            className="bg-transparent border border-gray-200 rounded-md px-2 py-0.5 text-sm font-semibold text-gray-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {THAI_MONTHS_FULL.map((name, i) => (
              <option key={i} value={i + 1}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={year}
            onChange={(e) => goTo(Number(e.target.value), month)}
            className="bg-transparent border border-gray-200 rounded-md px-2 py-0.5 text-sm font-semibold text-gray-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                พ.ศ. {y + 543}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={next}
          className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
          aria-label="เดือนถัดไป"
        >
          <ChevronRight className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      {/* ─── Day-of-week headers ─── */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {THAI_DAYS.map((d, i) => (
          <div
            key={d}
            className={cn(
              "text-center text-xs font-medium py-2",
              i === 0 || i === 6 ? "text-red-400" : "text-gray-500"
            )}
          >
            {d}
          </div>
        ))}
      </div>

      {/* ─── Calendar grid ─── */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (!day) {
            return (
              <div
                key={`empty-${idx}`}
                className="aspect-square border-b border-r border-gray-50"
              />
            );
          }

          const dow = (firstDow + idx) % 7; // 0 = Sun
          const dateStr = toDateStr(year, month, day);
          const isBlocked = blocked.has(dateStr);
          const hasUserApt = userDates.has(dateStr);
          const isToday = dateStr === todayStr;
          const isWeekend = dow === 0 || dow === 6;

          return (
            <div
              key={dateStr}
              className={cn(
                "relative aspect-square flex flex-col items-center justify-center text-sm border-b border-r border-gray-50",
                isBlocked && "bg-red-50",
                !isBlocked && hasUserApt && "bg-green-50"
              )}
            >
              {hasUserApt && (
                <span className="pointer-events-none absolute inset-1 rounded-sm border border-dashed border-green-500" />
              )}
              <span
                className={cn(
                  "w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium",
                  isToday && "bg-green-600 text-white font-bold",
                  isBlocked && !isToday && "text-red-600 font-semibold",
                  !isBlocked && hasUserApt && !isToday && "text-green-700 font-semibold",
                  !isBlocked && !hasUserApt && !isToday && isWeekend && "text-red-400",
                  !isBlocked && !hasUserApt && !isToday && !isWeekend && "text-gray-700"
                )}
              >
                {day}
              </span>
              {isBlocked && (
                <span className="text-[9px] leading-none mt-0.5 text-red-500">
                  ไม่ว่าง
                </span>
              )}
              {!isBlocked && hasUserApt && (
                <span className="text-[9px] leading-none mt-0.5 text-green-600">
                  นัดหมาย
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Legend ─── */}
      <div className="flex flex-wrap gap-4 px-4 py-3 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <div className="w-4 h-4 rounded bg-red-50 border border-red-200 flex-shrink-0" />
          <span>ผู้ใหญ่บ้านไม่ว่าง</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <div className="w-4 h-4 rounded bg-green-50 border border-dashed border-green-500 flex-shrink-0" />
          <span>มีนัดหมายของคุณ</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <div className="w-4 h-4 rounded-full bg-green-600 flex-shrink-0" />
          <span>วันนี้</span>
        </div>
      </div>
    </div>
  );
}
