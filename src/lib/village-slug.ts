export function normalizeVillageSlugInput(raw: string): string {
  const normalized = raw
    .trim()
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[\\/?#[\]@!$&'()*+,;=:%"<>|`~^]+/g, "-")
    .replace(/[^a-z0-9\u0E00-\u0E7F-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized;
}

export function normalizeVillageSlugParam(raw: string): string {
  return raw.trim().normalize("NFC");
}
