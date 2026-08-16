import { isSafeImageSource } from "@/lib/image-input";

/** Safely reads legacy JSON image values without exposing invalid entries to list UIs. */
export function normalizeIssueImageUrls(imageUrls: unknown): string[] {
  if (!Array.isArray(imageUrls)) return [];

  return imageUrls
    .filter((value): value is string => typeof value === "string")
    .map((url) => url.trim())
    .filter((url) => url.length > 0 && isSafeImageSource(url));
}
