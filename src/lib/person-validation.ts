export const PERSON_NAME_MAX_LENGTH = 100;
export const THAI_NATIONAL_ID_LENGTH = 13;
export const THAI_PHONE_LENGTH = 10;

export const PERSON_GENDER_VALUES = ["ชาย", "หญิง", "ไม่ระบุ"] as const;
export type PersonGender = (typeof PERSON_GENDER_VALUES)[number];

const PERSON_NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ .'-][\p{L}\p{M}]+)*\.?$/u;

const GENDER_ALIASES: Record<string, PersonGender> = {
  "ชาย": "ชาย",
  "หญิง": "หญิง",
  "ไม่ระบุ": "ไม่ระบุ",
  "MALE": "ชาย",
  "FEMALE": "หญิง",
  "UNSPECIFIED": "ไม่ระบุ",
  "UNKNOWN": "ไม่ระบุ",
};

export function normalizePersonName(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

export function isValidPersonName(value: string): boolean {
  const normalized = normalizePersonName(value);
  return normalized.length > 0
    && normalized.length <= PERSON_NAME_MAX_LENGTH
    && PERSON_NAME_PATTERN.test(normalized);
}

/** Client-safe typing normalization; final name validation remains non-destructive. */
export function normalizePersonNameInput(value: string): string {
  return value.replace(/[\p{N}]/gu, "").slice(0, PERSON_NAME_MAX_LENGTH);
}

export function normalizeThaiDigits(value: string): string {
  return value.replace(/[\u0E50-\u0E59]/g, (digit) => String(digit.charCodeAt(0) - 0x0e50)).replace(/\D/g, "");
}

export function normalizeThaiNationalIdInput(value: string): string {
  return normalizeThaiDigits(value).slice(0, THAI_NATIONAL_ID_LENGTH);
}

export function normalizeThaiPhoneInput(value: string): string {
  return normalizeThaiDigits(value).slice(0, THAI_PHONE_LENGTH);
}

export function isValidOptionalThaiPhone(value: string): boolean {
  return !value || /^\d{10}$/.test(value);
}

/** Returns null only for values outside the explicit canonical/legacy whitelist. */
export function normalizePersonGender(value: string | null | undefined): PersonGender | null {
  const normalized = value?.trim();
  if (!normalized) return "ไม่ระบุ";
  return GENDER_ALIASES[normalized.toLocaleUpperCase("en-US")] ?? GENDER_ALIASES[normalized] ?? null;
}

export type PersonDateValidation =
  | { valid: true; value: Date | null }
  | { valid: false; reason: "INVALID" | "FUTURE" };

export function validateOptionalPersonDate(value: string | null | undefined, today = new Date()): PersonDateValidation {
  const normalized = value?.trim() ?? "";
  if (!normalized) return { valid: true, value: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return { valid: false, reason: "INVALID" };
  const [year, month, day] = normalized.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    return { valid: false, reason: "INVALID" };
  }
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  if (parsed.getTime() > todayUtc) return { valid: false, reason: "FUTURE" };
  return { valid: true, value: parsed };
}
