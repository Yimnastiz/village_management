export type PopulationEventValue = "MOVE_IN" | "MOVE_OUT" | "BIRTH" | "DEATH" | "TRANSFER";

const POPULATION_EVENT_ALIASES: Record<string, PopulationEventValue> = {
  "ย้ายเข้า": "MOVE_IN",
  "ย้ายเข้ามา": "MOVE_IN",
  "ย้ายออก": "MOVE_OUT",
  "ย้ายออกไป": "MOVE_OUT",
  "เกิด": "BIRTH",
  "แจ้งเกิด": "BIRTH",
  "เสียชีวิต": "DEATH",
  "แจ้งเสียชีวิต": "DEATH",
  "ย้ายภายใน": "TRANSFER",
  "ย้ายภายในหมู่บ้าน": "TRANSFER",
  "โอนย้ายภายใน": "TRANSFER",
};

const RAW_EVENT_VALUES = new Set<PopulationEventValue>(["MOVE_IN", "MOVE_OUT", "BIRTH", "DEATH", "TRANSFER"]);

export function parsePopulationImportDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
  if (!text) return null;

  // ISO dates are legacy-compatible. New Thai template dates are DD-MM-BE or DD/MM/BE.
  const match = text.match(/^(?:(\d{4})-(\d{2})-(\d{2})|(\d{2})[/-](\d{2})[/-](\d{4}))$/);
  if (!match) return null;
  const year = Number(match[1] ?? match[6]);
  const month = Number(match[2] ?? match[5]);
  const day = Number(match[3] ?? match[4]);
  const gregorianYear = year >= 2400 ? year - 543 : year;
  const parsed = new Date(Date.UTC(gregorianYear, month - 1, day));
  return parsed.getUTCFullYear() === gregorianYear && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? parsed : null;
}

export function parsePopulationEvent(value: unknown): PopulationEventValue | null {
  const text = typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
  if (!text) return null;
  const normalized = text.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const enumValue = normalized.toUpperCase().replace(/[ -]+/g, "_") as PopulationEventValue;
  return RAW_EVENT_VALUES.has(enumValue) ? enumValue : POPULATION_EVENT_ALIASES[normalized] ?? null;
}

export const POPULATION_EVENT_THAI_OPTIONS = ["ย้ายเข้า", "ย้ายออก", "เกิด", "เสียชีวิต", "ย้ายภายใน"] as const;
