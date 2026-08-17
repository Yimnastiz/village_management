const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";
const THAI_NAME_WORD = "[\u0E01-\u0E2E\u0E30-\u0E4E]+";
const THAI_NAME_PATTERN = new RegExp(`^${THAI_NAME_WORD}(?:[ .'’-]${THAI_NAME_WORD})*$`);

export function normalizeNationalId(value: string): string {
  return value.replace(/[๐-๙]/g, (digit) => String(THAI_DIGITS.indexOf(digit))).replace(/\D/g, "");
}

export function isValidThaiNationalId(value: string): boolean {
  const digits = normalizeNationalId(value);
  if (!/^\d{13}$/.test(digits)) return false;
  const checksum = digits.slice(0, 12).split("").reduce((sum, digit, index) => sum + Number(digit) * (13 - index), 0);
  return (11 - (checksum % 11)) % 10 === Number(digits[12]);
}

export function isValidStrictThaiNationalId(value: string): boolean {
  const normalized = value.trim();
  return /^[0-9๐-๙]{13}$/.test(normalized) && isValidThaiNationalId(normalized);
}

export function normalizeThaiName(value: string): string {
  return value
    .replace(/[0-9๐-๙]/g, "")
    .replace(/[^\u0E01-\u0E2E\u0E30-\u0E4E\s.'’-]/g, "")
    .replace(/\s+/g, " ")
    .trimStart();
}

export function isValidThaiName(value: string): boolean {
  const compact = value.trim().replace(/\s+/g, " ");
  return compact === normalizeThaiName(value).trim() && THAI_NAME_PATTERN.test(compact);
}
