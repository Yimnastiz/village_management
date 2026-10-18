export function getNewsImageCount(imageUrls: unknown, coverUrl?: string | null): number {
  const urls = Array.isArray(imageUrls)
    ? imageUrls.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];

  if (typeof coverUrl === "string" && coverUrl.trim().length > 0) {
    urls.push(coverUrl);
  }

  return new Set(urls.map((url) => url.trim())).size;
}
