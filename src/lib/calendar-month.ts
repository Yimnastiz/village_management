export const THAI_MONTH_NAMES = [
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

export const THAI_MONTH_SHORT_NAMES = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

export type CalendarMonthState = {
  year: number;
  monthIndex: number;
  yearStart: number;
  yearEnd: number;
};

export function getCalendarYearRange(baseDate = new Date()) {
  const currentYear = baseDate.getFullYear();
  return {
    yearStart: currentYear - 5,
    yearEnd: currentYear + 10,
  };
}

export function parseCalendarMonth(month?: string, baseDate = new Date()): CalendarMonthState {
  const { yearStart, yearEnd } = getCalendarYearRange(baseDate);
  const fallback = {
    year: baseDate.getFullYear(),
    monthIndex: baseDate.getMonth(),
    yearStart,
    yearEnd,
  };

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return fallback;
  }

  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(monthIndex) ||
    year < yearStart ||
    year > yearEnd ||
    monthIndex < 0 ||
    monthIndex > 11
  ) {
    return fallback;
  }

  return { year, monthIndex, yearStart, yearEnd };
}

export function toMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function toDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(value);
}

export function formatThaiMonthYear(year: number, monthIndex: number, variant: "long" | "short" = "long") {
  const monthNames = variant === "long" ? THAI_MONTH_NAMES : THAI_MONTH_SHORT_NAMES;
  return `${monthNames[monthIndex] ?? ""} ${year + 543}`;
}
