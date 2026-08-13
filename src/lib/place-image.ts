import { MAX_IMAGES_PER_REQUEST } from "@/lib/image-constraints";

export type PlaceImageInput = {
  id?: string;
  url?: string;
  fileKey?: string;
  uploadToken?: string;
  sortOrder: number;
  isCover: boolean;
};

export type PlaceImageView = Required<Pick<PlaceImageInput, "url" | "sortOrder" | "isCover">> & {
  id?: string;
  fileKey?: string | null;
  uploadToken?: string;
};

export function normalizePlaceImages(images: readonly PlaceImageInput[]): PlaceImageInput[] {
  const trimmed = images.slice(0, MAX_IMAGES_PER_REQUEST).map((image) => ({
    id: image.id?.trim() || undefined,
    url: image.url?.trim() || undefined,
    fileKey: image.fileKey?.trim() || undefined,
    uploadToken: image.uploadToken?.trim() || undefined,
    sortOrder: 0,
    isCover: Boolean(image.isCover),
  })).filter((image) => image.id || image.url);
  const coverIndex = Math.max(0, trimmed.findIndex((image) => image.isCover));
  return trimmed.map((image, index) => ({ ...image, sortOrder: index, isCover: index === coverIndex }));
}

export function legacyImageViews(imageUrls: unknown): PlaceImageView[] {
  if (!Array.isArray(imageUrls)) return [];
  return imageUrls.map(String).map((url) => url.trim()).filter(Boolean).slice(0, MAX_IMAGES_PER_REQUEST)
    .map((url, sortOrder) => ({ url, sortOrder, isCover: sortOrder === 0 }));
}

export function orderedPlaceImages(
  images: readonly PlaceImageView[] | null | undefined,
  legacyImageUrls?: unknown,
): PlaceImageView[] {
  const source = images?.length ? [...images] : legacyImageViews(legacyImageUrls);
  source.sort((a, b) => a.sortOrder - b.sortOrder);
  const coverIndex = source.findIndex((image) => image.isCover);
  if (coverIndex > 0) source.unshift(source.splice(coverIndex, 1)[0]);
  return source;
}

export function parsePlaceImageInputs(value: unknown): PlaceImageInput[] | null {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > MAX_IMAGES_PER_REQUEST) return null;
  const parsed: PlaceImageInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    if (row.id != null && typeof row.id !== "string") return null;
    if (row.url != null && typeof row.url !== "string") return null;
    if (row.fileKey != null && typeof row.fileKey !== "string") return null;
    if (row.uploadToken != null && typeof row.uploadToken !== "string") return null;
    parsed.push({
      id: typeof row.id === "string" ? row.id : undefined,
      url: typeof row.url === "string" ? row.url : undefined,
      fileKey: typeof row.fileKey === "string" ? row.fileKey : undefined,
      uploadToken: typeof row.uploadToken === "string" ? row.uploadToken : undefined,
      sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : parsed.length,
      isCover: Boolean(row.isCover),
    });
  }
  return normalizePlaceImages(parsed);
}
