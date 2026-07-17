const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

export function normalizeHouseNumber(value: string): string {
  return value
    .trim()
    .replace(/[๐-๙]/g, (digit) => String(THAI_DIGITS.indexOf(digit)))
    .replace(/\s+/g, "")
    .replace(/\/{2,}/g, "/")
    .toUpperCase();
}

export function isValidHouseNumber(value: string): boolean {
  const normalized = normalizeHouseNumber(value);
  return normalized.length >= 1 && normalized.length <= 50 && /^[0-9]+(?:[\/-][0-9A-Z]+)*$/.test(normalized);
}
