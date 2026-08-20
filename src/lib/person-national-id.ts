import { isValidStrictThaiNationalId, normalizeNationalId } from "@/lib/thai-identity";

export const INVALID_NATIONAL_ID_MESSAGE = "เลขบัตรประชาชนไม่ถูกต้อง";
export const LINKED_NATIONAL_ID_IMMUTABLE_MESSAGE = "เลขบัตรประชาชนเชื่อมกับบัญชีผู้ใช้แล้วและแก้ไขจากทะเบียนประชากรไม่ได้";

type ExistingNationalId = {
  nationalId: string | null;
  userId: string | null;
};

export type NationalIdUpdateResolution =
  | { ok: true; nationalId: string | null; changed: boolean }
  | { ok: false; message: typeof INVALID_NATIONAL_ID_MESSAGE | typeof LINKED_NATIONAL_ID_IMMUTABLE_MESSAGE };

function submittedNationalId(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Keep the exact persisted value when a submitted ID has the same identity.
 * This lets legacy IDs remain untouched while still accepting Thai-digit and
 * ASCII-digit representations of the same 13 digits.
 */
export function isSameNationalId(existingNationalId: string | null, submittedValue: unknown) {
  const submitted = submittedNationalId(submittedValue);
  const existing = existingNationalId ?? "";
  if (existing === submitted) return true;

  const existingDigits = normalizeNationalId(existing);
  const submittedDigits = normalizeNationalId(submitted);
  return /^\d{13}$/.test(existingDigits) && existingDigits === submittedDigits;
}

export function normalizeNewNationalId(value: unknown): string | null {
  const rawNationalId = submittedNationalId(value);
  if (!rawNationalId) return null;
  if (!isValidStrictThaiNationalId(rawNationalId)) throw new Error(INVALID_NATIONAL_ID_MESSAGE);
  return normalizeNationalId(rawNationalId);
}

export function resolveUpdatedNationalId(existing: ExistingNationalId, submittedValue: unknown): NationalIdUpdateResolution {
  if (isSameNationalId(existing.nationalId, submittedValue)) {
    return { ok: true, nationalId: existing.nationalId, changed: false };
  }
  if (existing.userId) return { ok: false, message: LINKED_NATIONAL_ID_IMMUTABLE_MESSAGE };

  try {
    return { ok: true, nationalId: normalizeNewNationalId(submittedValue), changed: true };
  } catch {
    return { ok: false, message: INVALID_NATIONAL_ID_MESSAGE };
  }
}
