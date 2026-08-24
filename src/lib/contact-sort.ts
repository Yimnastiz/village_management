export const CONTACT_SORT_OPTIONS = [
  { value: "recommended", label: "ลำดับแนะนำ" },
  { value: "name_asc", label: "ชื่อ ก-ฮ" },
  { value: "name_desc", label: "ชื่อ ฮ-ก" },
  { value: "newest", label: "เพิ่มล่าสุด" },
] as const;

export type ContactSort = (typeof CONTACT_SORT_OPTIONS)[number]["value"];

const validSorts = new Set<ContactSort>(CONTACT_SORT_OPTIONS.map((option) => option.value));
const thaiNameCollator = new Intl.Collator("th-TH", { sensitivity: "base", numeric: true });

export function parseContactSort(value: string | undefined | null): ContactSort {
  // Preserve existing directory bookmarks while emitting only the canonical values.
  if (value === "name") return "name_asc";
  if (value === "default" || value === "sort") return "recommended";
  return value && validSorts.has(value as ContactSort) ? value as ContactSort : "recommended";
}

/** Thai-aware, deterministic name sort for the compact directory lists. */
export function sortContactsByName<T extends { id: string; name: string }>(contacts: T[], direction: "asc" | "desc") {
  return [...contacts].sort((left, right) => {
    const compared = thaiNameCollator.compare(left.name, right.name);
    if (compared) return direction === "asc" ? compared : -compared;
    return left.id.localeCompare(right.id);
  });
}
