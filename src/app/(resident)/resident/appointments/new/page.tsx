"use client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, AlertCircle, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { createAppointmentAction } from "../actions";
import { useEffect, useMemo, useState } from "react";
import { formatThaiDate } from "@/lib/utils";
import type { AppointmentSlot } from "@prisma/client";

const schema = z.object({
  title: z.string().min(3, "กรุณาระบุหัวข้ออย่างน้อย 3 ตัวอักษร"),
  requestedDate: z.string().min(1, "กรุณาเลือกวันที่นัดหมาย"),
  description: z.string().optional(),
  slotId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const THAI_DAY_HEADERS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatThaiShortDayMonth(date: Date): string {
  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
  });
}

export default function NewAppointmentPage() {
  const router = useRouter();
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const todayStr = toDateStr(new Date());
  const [displayYear, setDisplayYear] = useState(new Date().getFullYear());
  const [displayMonth, setDisplayMonth] = useState(new Date().getMonth());
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => currentYear - 1 + i);
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      requestedDate: "",
      slotId: "",
    },
  });

  const selectedDate = watch("requestedDate");

  useEffect(() => {
    fetch("/api/appointments/available-slots")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setSlots(data))
      .catch(() => {}) // Silently fail — slots are optional
      .finally(() => setIsLoadingSlots(false));
  }, []);

  const availableDateSet = useMemo(() => {
    const s = new Set<string>();
    for (const slot of slots) {
      s.add(toDateStr(new Date(slot.date)));
    }
    return s;
  }, [slots]);

  useEffect(() => {
    if (!selectedDate && availableDateSet.size > 0) {
      const sortedDates = [...availableDateSet].sort();
      const firstSelectable = sortedDates.find((d) => d >= todayStr);
      if (firstSelectable) {
        setValue("requestedDate", firstSelectable, { shouldValidate: true });
      }
    }
  }, [availableDateSet, selectedDate, setValue, todayStr]);

  useEffect(() => {
    setValue("slotId", "", { shouldValidate: true });
  }, [selectedDate, setValue]);

  const monthStart = useMemo(() => new Date(displayYear, displayMonth, 1), [displayYear, displayMonth]);
  const daysInMonth = useMemo(() => new Date(displayYear, displayMonth + 1, 0).getDate(), [displayYear, displayMonth]);
  const firstDayOfWeek = monthStart.getDay();

  const calendarCells = useMemo(() => {
    const cells: Array<{ dateStr: string; day: number; isAvailable: boolean; isPast: boolean } | null> = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(displayYear, displayMonth, day);
      const dateStr = toDateStr(date);
      const isPast = dateStr < todayStr;
      const isAvailable = !isPast && availableDateSet.has(dateStr);
      cells.push({ dateStr, day, isAvailable, isPast });
    }
    return cells;
  }, [availableDateSet, daysInMonth, displayMonth, displayYear, firstDayOfWeek, todayStr]);

  const dailyStatus = useMemo(() => {
    const rows: Array<{ dateStr: string; label: string }> = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(displayYear, displayMonth, day);
      const dateStr = toDateStr(date);
      if (dateStr < todayStr) continue;
      if (!availableDateSet.has(dateStr)) continue;
      rows.push({
        dateStr,
        label: formatThaiShortDayMonth(date),
      });
    }
    return rows;
  }, [availableDateSet, daysInMonth, displayMonth, displayYear, todayStr]);

  const changeMonth = (dir: -1 | 1) => {
    const next = new Date(displayYear, displayMonth + dir, 1);
    setDisplayYear(next.getFullYear());
    setDisplayMonth(next.getMonth());
  };

  const slotOptions = useMemo(
    () =>
      slots
        .filter((s) => toDateStr(new Date(s.date)) === selectedDate)
        .map((s) => ({
          value: s.id,
          label: `${formatThaiDate(s.date)} เวลา ${s.startTime} – ${s.endTime}`,
        })),
    [slots, selectedDate]
  );

  const isSelectedDateUnavailable = Boolean(selectedDate) && !isLoadingSlots && slotOptions.length === 0;

  const onSubmit = async (data: FormValues) => {
    setSubmitError(null);

    if (isSelectedDateUnavailable) {
      setSubmitError("วันที่ที่เลือกผู้ใหญ่บ้านไม่ว่าง กรุณาเลือกวันอื่น");
      return;
    }

    const formData = new FormData();
    formData.append("title", data.title);
    formData.append("requestedDate", data.requestedDate);
    if (data.description) formData.append("description", data.description);
    if (data.slotId) formData.append("slotId", data.slotId);

    const result = await createAppointmentAction(formData);
    if (!result.success) {
      setSubmitError(result.error);
      return;
    }

    setSuccess("ขอจองนัดหมายเรียบร้อยแล้ว");
    setTimeout(() => router.push(`/resident/appointments/${result.appointmentId}?success=1`), 700);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/resident/appointments" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">ขอจองนัดหมาย</h1>
      </div>

      {submitError && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
      >
        <Input
          label="เรื่องที่ต้องการนัดหมาย"
          {...register("title")}
          error={errors.title?.message}
          placeholder="เช่น ขอทำทะเบียนบ้าน, ยื่นเรื่องขอความช่วยเหลือ"
        />

        <input type="hidden" {...register("requestedDate")} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">วันที่นัดหมาย *</label>

          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="p-1.5 rounded-md hover:bg-gray-200"
                aria-label="เดือนก่อนหน้า"
              >
                <ChevronLeft className="h-4 w-4 text-gray-700" />
              </button>

              <div className="flex items-center gap-2">
                <select
                  value={displayMonth}
                  onChange={(e) => setDisplayMonth(Number(e.target.value))}
                  className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                  aria-label="เลือกเดือน"
                >
                  {THAI_MONTHS.map((monthName, idx) => (
                    <option key={monthName} value={idx}>
                      {monthName}
                    </option>
                  ))}
                </select>
                <select
                  value={displayYear}
                  onChange={(e) => setDisplayYear(Number(e.target.value))}
                  className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                  aria-label="เลือกปี"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      พ.ศ. {year + 543}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="p-1.5 rounded-md hover:bg-gray-200"
                aria-label="เดือนถัดไป"
              >
                <ChevronRight className="h-4 w-4 text-gray-700" />
              </button>
            </div>

            <div className="grid grid-cols-7 border-b border-gray-100 bg-white">
              {THAI_DAY_HEADERS.map((d) => (
                <div key={d} className="text-center py-2 text-xs font-medium text-gray-500">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 bg-white">
              {calendarCells.map((cell, idx) => {
                if (!cell) {
                  return <div key={`empty-${idx}`} className="aspect-square border-t border-r border-gray-50" />;
                }

                const isSelected = selectedDate === cell.dateStr;
                const isDisabled = !cell.isAvailable;

                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => setValue("requestedDate", cell.dateStr, { shouldValidate: true })}
                    className={`aspect-square border-t border-r text-sm transition-colors ${
                      isSelected
                        ? "bg-green-600 text-white font-semibold"
                        : isDisabled
                          ? "bg-red-50 text-red-300 cursor-not-allowed"
                          : "bg-white text-gray-700 hover:bg-green-50"
                    }`}
                    title={
                      isDisabled
                        ? cell.isPast
                          ? "ผ่านมาแล้ว"
                          : "ผู้ใหญ่บ้านไม่ว่าง"
                        : "เลือกวันนัดหมาย"
                    }
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1 text-gray-600">
              <span className="h-3 w-3 rounded bg-green-100 border border-green-300" /> ว่าง
            </span>
            <span className="inline-flex items-center gap-1 text-gray-600">
              <span className="h-3 w-3 rounded bg-red-100 border border-red-300" /> ไม่ว่าง
            </span>
          </div>

          {selectedDate && (
            <p className="mt-2 text-xs text-gray-500">วันที่เลือก: {formatThaiDate(selectedDate)}</p>
          )}

          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-600 mb-2">วันที่ว่างในเดือนนี้</p>
            <div className="flex flex-wrap gap-2">
              {dailyStatus.length === 0 ? (
                <span className="text-xs text-gray-400">ไม่มีวันที่ว่างให้จองในเดือนนี้</span>
              ) : (
                dailyStatus.map((d) => (
                  <span
                    key={d.dateStr}
                    className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium bg-green-100 text-green-700 border border-green-200"
                  >
                    {d.label}: ว่าง
                  </span>
                ))
              )}
            </div>
          </div>

          {errors.requestedDate?.message && (
            <p className="mt-1 text-xs text-red-600">{errors.requestedDate.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            เลือกช่วงเวลา <span className="font-normal text-gray-400">(ไม่บังคับ)</span>
          </label>
          {isLoadingSlots ? (
            <div className="text-sm text-gray-400 py-2">กำลังโหลดเวลาที่ว่าง…</div>
          ) : (
            <Select
              {...register("slotId")}
              options={slotOptions}
              placeholder={
                isSelectedDateUnavailable
                  ? "วันที่เลือกไม่ว่าง กรุณาเปลี่ยนวันที่"
                  : "— ไม่เลือก (ให้ผู้ใหญ่บ้านกำหนดให้) —"
              }
              error={errors.slotId?.message}
            />
          )}
          {isSelectedDateUnavailable ? (
            <p className="text-xs text-red-600 mt-1">วันที่นี้ผู้ใหญ่บ้านไม่ว่าง กรุณาเลือกวันอื่น</p>
          ) : (
            <p className="text-xs text-gray-400 mt-1">
              หากไม่เลือกช่วงเวลา ผู้ใหญ่บ้านสามารถจัดเวลาให้ภายหลังได้
            </p>
          )}
        </div>

        <Textarea
          label="รายละเอียดเพิ่มเติม"
          {...register("description")}
          placeholder="อธิบายรายละเอียดความต้องการหรือเอกสารที่ต้องเตรียม…"
        />

        <div className="flex gap-3 pt-2">
          <Button type="submit" isLoading={isSubmitting}>
            ส่งคำขอนัด
          </Button>
          <Link href="/resident/appointments">
            <Button type="button" variant="outline">
              ยกเลิก
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}

