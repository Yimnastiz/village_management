const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const ENCODED_ESCAPE = /%(?:2f|5c|00|0d|0a)/i;

export function sanitizeInternalCallbackUrl(
  value: string | null | undefined,
  fallback: string | null = null,
): string | null {
  if (!value) return fallback;
  const candidate = value.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\") || CONTROL_CHARACTERS.test(candidate) || ENCODED_ESCAPE.test(candidate)) return fallback;
  try {
    const decoded = decodeURIComponent(candidate);
    if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\") || CONTROL_CHARACTERS.test(decoded)) return fallback;
  } catch {
    return fallback;
  }
  return candidate;
}

/** House Account sessions are Resident-only, so callbacks stay in that area. */
export function sanitizeResidentCallbackUrl(
  value: string | null | undefined,
  fallback: string | null = null,
): string | null {
  const candidate = sanitizeInternalCallbackUrl(value);
  if (candidate === "/resident" || candidate?.startsWith("/resident/")) return candidate;
  return fallback;
}

export function sanitizeAdminCallbackUrl(
  value: string | null | undefined,
  fallback: string | null = null,
): string | null {
  const candidate = sanitizeInternalCallbackUrl(value);
  if (candidate === "/admin" || candidate?.startsWith("/admin/")) return candidate;
  return fallback;
}
