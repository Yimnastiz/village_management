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

export const CONTACT_PHONE_MIN_LENGTH = 3;
export const CONTACT_PHONE_MAX_LENGTH = 10;

export function isContactCategory(value: string): value is ContactCategory {
  return (CONTACT_CATEGORIES as readonly string[]).includes(value);
}

/** Normalizes interactive directory-phone input without changing unrelated text fields. */
export function normalizeContactPhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, CONTACT_PHONE_MAX_LENGTH);
}

export function validateContactPhone(value: string, required = true): string | null {
  if (!value) return required ? "กรุณาระบุเบอร์โทร" : null;
  if (!/^\d+$/.test(value)) return "เบอร์โทรต้องเป็นตัวเลข 0-9 เท่านั้น";
  if (value.length < CONTACT_PHONE_MIN_LENGTH || value.length > CONTACT_PHONE_MAX_LENGTH) {
    return `เบอร์โทรต้องมี ${CONTACT_PHONE_MIN_LENGTH}–${CONTACT_PHONE_MAX_LENGTH} หลัก`;
  }
  return null;
}
