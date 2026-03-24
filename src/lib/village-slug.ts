export function normalizeVillageSlugInput(raw: string): string {
  // Try URL-decoding first so pasted/stored percent-encoded slugs are handled
  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // malformed %-sequence — use the trimmed original
  }

  const normalized = decoded
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\u0000-\u001f\u007f\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[\\/?#[\]@!$&'()*+,;=:%"<>|`~^]+/g, "-")
    .replace(/[^a-z0-9\u0E00-\u0E7F-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized;
}

export function normalizeVillageSlugParam(raw: string): string {
  return raw.trim().normalize("NFC").replace(/[\u200b-\u200d\ufeff]/g, "");
}

/**
 * Returns slug variants to use in a Prisma `{ in: [...] }` query.
 * For Thai slugs, the DB may have stored the percent-encoded form
 * (legacy garbled data). This helper returns both forms so either matches.
 */
export function getSlugVariants(slug: string): string[] {
  const normalizedParam = normalizeVillageSlugParam(slug);
  const normalizedInput = normalizeVillageSlugInput(slug);

  const baseCandidates = [slug, normalizedParam, normalizedInput].filter(Boolean);
  const variants = new Set<string>();

  for (const candidate of baseCandidates) {
    variants.add(candidate);

    const encoded = encodeURIComponent(candidate);
    variants.add(encoded);
    variants.add(encoded.toLowerCase());

    try {
      variants.add(decodeURIComponent(candidate));
    } catch {
      // ignore malformed encoding and keep existing variants
    }
  }

  return Array.from(variants);
}
