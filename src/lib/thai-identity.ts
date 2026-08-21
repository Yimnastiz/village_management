const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";
const THAI_NAME_WORD = "[\u0E01-\u0E2E\u0E30-\u0E4E]+";
const THAI_NAME_PATTERN = new RegExp(`^${THAI_NAME_WORD}(?:[ .'’-]${THAI_NAME_WORD})*$`);
let hasLoggedChecksumBypassWarning = false;

export function normalizeNationalId(value: string): string {
  return value.replace(/[๐-๙]/g, (digit) => String(THAI_DIGITS.indexOf(digit))).replace(/\D/g, "");
}

export function isValidThaiNationalId(value: string): boolean {
  const digits = normalizeNationalId(value);
  if (!/^\d{13}$/.test(digits)) return false;
  const checksum = digits.slice(0, 12).split("").reduce((sum, digit, index) => sum + Number(digit) * (13 - index), 0);
  return (11 - (checksum % 11)) % 10 === Number(digits[12]);
}

/**
 * This is intentionally evaluated on the server at validation time so a
 * production deployment remains strict even if the environment variable is
 * accidentally configured there.
 */
export function isThaiNationalIdChecksumBypassEnabled(): boolean {
  const enabled = process.env.NODE_ENV !== "production" && process.env.DEV_BYPASS_THAI_NATIONAL_ID_CHECK === "true";
  if (enabled && !hasLoggedChecksumBypassWarning) {
    console.warn("[dev] Thai national ID checksum validation is bypassed.");
    hasLoggedChecksumBypassWarning = true;
  }
  return enabled;
}

export function isThaiNationalIdFormat(value: string): boolean {
  return /^[0-9๐-๙]{13}$/.test(value.trim());
}

export function isValidStrictThaiNationalId(value: string): boolean {
  if (!isThaiNationalIdFormat(value)) return false;
  return isThaiNationalIdChecksumBypassEnabled() || isValidThaiNationalId(value);
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
