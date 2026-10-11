export const EMAIL_MAX_LENGTH = 320;

/** Conservatively normalize the global account-email identity. */
export function normalizeAccountEmail(email) {
  return email.trim().toLocaleLowerCase("en-US");
}

/** Shared application-level validation for login and contact email fields. */
export function isValidEmailAddress(email) {
  const normalized = normalizeAccountEmail(email);
  return normalized.length > 0
    && normalized.length <= EMAIL_MAX_LENGTH
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

/** Mask an email for UI status and development-only delivery logs. */
export function maskEmail(email) {
  const normalized = email.trim();
  const separator = normalized.lastIndexOf("@");
  if (separator <= 0 || separator === normalized.length - 1) return "***";

  const firstCharacter = Array.from(normalized.slice(0, separator))[0] ?? "";
  return `${firstCharacter}***@${normalized.slice(separator + 1)}`;
}
