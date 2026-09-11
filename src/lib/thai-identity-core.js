const THAI_DIGIT_OFFSET = 0x0e50;
let hasLoggedChecksumBypassWarning = false;

export function normalizeNationalId(value) {
  return value.replace(/[\u0E50-\u0E59]/g, (digit) => String(digit.codePointAt(0) - THAI_DIGIT_OFFSET)).replace(/\D/g, "");
}

export function isValidThaiNationalId(value) {
  const digits = normalizeNationalId(value);
  if (!/^\d{13}$/.test(digits)) return false;
  const checksum = digits.slice(0, 12).split("").reduce((sum, digit, index) => sum + Number(digit) * (13 - index), 0);
  return (11 - (checksum % 11)) % 10 === Number(digits[12]);
}

export function isThaiNationalIdChecksumBypassEnabled() {
  const enabled = process.env.NODE_ENV !== "production" && process.env.DEV_BYPASS_THAI_NATIONAL_ID_CHECK === "true";
  if (enabled && !hasLoggedChecksumBypassWarning) {
    console.warn("[dev] Thai national ID checksum validation is bypassed.");
    hasLoggedChecksumBypassWarning = true;
  }
  return enabled;
}

export function isThaiNationalIdFormat(value) {
  return /^[0-9\u0E50-\u0E59]{13}$/.test(value.trim());
}

export function isValidStrictThaiNationalId(value) {
  if (!isThaiNationalIdFormat(value)) return false;
  return isThaiNationalIdChecksumBypassEnabled() || isValidThaiNationalId(value);
}
