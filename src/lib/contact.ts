import { EMAIL_MAX_LENGTH, isValidEmailAddress, normalizeAccountEmail } from "./account-email-normalization.js";

export const CONTACT_CATEGORIES = [
  "ผู้นำชุมชน",
  "หน่วยงานราชการ",
  "ฉุกเฉินและความปลอดภัย",
  "สาธารณสุข",
  "สาธารณูปโภค",
  "ช่างและบริการ",
  "ร้านค้าและบริการ",
  "อื่น ๆ",
] as const;

export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];

export const CONTACT_CATEGORY_OPTIONS = CONTACT_CATEGORIES.map((value) => ({ value, label: value }));

/** Keeps filters canonical while still making values on historical records discoverable. */
export function contactFilterCategories(values: Array<string | null | undefined>) {
  const legacy = Array.from(new Set(values.filter((value): value is string => typeof value === "string" && Boolean(value.trim()) && !isContactCategory(value.trim())).map((value) => value.trim())))
    .sort((a, b) => a.localeCompare(b, "th"));
  return [...CONTACT_CATEGORIES, ...legacy];
}

export const CONTACT_PHONE_MIN_LENGTH = 3;
export const CONTACT_PHONE_MAX_LENGTH = 10;
export const CONTACT_EMAIL_MAX_LENGTH = EMAIL_MAX_LENGTH;
export const VILLAGE_PHONE_MAX_LENGTH = 50;

export function isContactCategory(value: string): value is ContactCategory {
  return (CONTACT_CATEGORIES as readonly string[]).includes(value);
}

/** Normalizes interactive directory-phone input without changing unrelated text fields. */
export function normalizeContactPhone(value: string): string {
  return value.trim().replace(/[\u0E50-\u0E59]/g, (digit) => String(digit.charCodeAt(0) - 0x0e50));
}

export function validateContactPhone(value: string, required = true): string | null {
  if (!value) return required ? "กรุณาระบุเบอร์โทร" : null;
  if (!/^\d+$/.test(value)) return "เบอร์โทรต้องเป็นตัวเลข 0-9 เท่านั้น";
  if (value.length < CONTACT_PHONE_MIN_LENGTH || value.length > CONTACT_PHONE_MAX_LENGTH) {
    return `เบอร์โทรต้องมี ${CONTACT_PHONE_MIN_LENGTH}–${CONTACT_PHONE_MAX_LENGTH} หลัก`;
  }
  return null;
}

export function validateContactEmail(value: string): string | null {
  if (!value) return null;
  return isValidEmailAddress(value) ? null : "รูปแบบอีเมลไม่ถูกต้อง";
}
export function normalizeContactEmail(value: string): string {
  return normalizeAccountEmail(value);
}

export function normalizeVillagePhone(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function validateVillagePhone(value: string): string | null {
  const normalized = normalizeVillagePhone(value);
  if (!normalized) return null;
  if (normalized.length > VILLAGE_PHONE_MAX_LENGTH) return "หมายเลขโทรศัพท์ยาวเกินกำหนด";
  if (!/^(?=.*\d)[\d\s()+-]+$/.test(normalized)) return "รูปแบบหมายเลขโทรศัพท์ไม่ถูกต้อง";
  return null;
}
