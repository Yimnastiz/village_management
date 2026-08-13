import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";
import { normalizePlaceImages, type PlaceImageInput } from "@/lib/place-image";
import { verifyPlaceUploadToken } from "@/lib/place-upload.server";

type Db = PrismaClient | Prisma.TransactionClient;
export type PlaceImageRowInput = { url: string; fileKey: string | null; sortOrder: number; isCover: boolean };

function expectedUrl(fileKey: string) {
  return `/api/places/images?key=${encodeURIComponent(fileKey)}`;
}

export async function materializePlaceImages(db: Db, images: readonly PlaceImageInput[], villageId: string, options?: { existingPlaceId?: string; trustedNew?: boolean }): Promise<PlaceImageRowInput[] | null> {
  const normalized = normalizePlaceImages(images);
  const ids = normalized.flatMap((image) => image.id ? [image.id] : []);
  const existing = ids.length ? await db.villagePlaceImage.findMany({ where: { id: { in: ids }, place: { villageId, ...(options?.existingPlaceId ? { id: options.existingPlaceId } : {}) } }, select: { id: true, url: true, fileKey: true } }) : [];
  const byId = new Map(existing.map((image) => [image.id, image]));
  const result: PlaceImageRowInput[] = [];
  for (const image of normalized) {
    if (image.id) {
      const row = byId.get(image.id); if (!row) return null;
      result.push({ url: row.url, fileKey: row.fileKey, sortOrder: image.sortOrder, isCover: image.isCover });
      continue;
    }
    if (options?.trustedNew && image.url && !image.fileKey) {
      result.push({ url: image.url, fileKey: null, sortOrder: image.sortOrder, isCover: image.isCover });
      continue;
    }
    if (!image.url || !image.fileKey || image.url !== expectedUrl(image.fileKey)) return null;
    if (!options?.trustedNew && !verifyPlaceUploadToken(image.uploadToken, image.fileKey, villageId)) return null;
    result.push({ url: image.url, fileKey: image.fileKey, sortOrder: image.sortOrder, isCover: image.isCover });
  }
  return result;
}

export async function sanitizeSubmissionImages(db: Db, images: readonly PlaceImageInput[], villageId: string, targetPlaceId?: string) {
  const materialized = await materializePlaceImages(db, images, villageId, { existingPlaceId: targetPlaceId });
  if (!materialized) return null;
  const normalized = normalizePlaceImages(images);
  return normalized.map((image, index) => image.id
    ? { id: image.id, sortOrder: index, isCover: materialized[index].isCover }
    : { url: materialized[index].url, fileKey: materialized[index].fileKey ?? undefined, sortOrder: index, isCover: materialized[index].isCover });
}

export async function replacePlaceImages(db: Prisma.TransactionClient, placeId: string, rows: readonly PlaceImageRowInput[]) {
  await db.villagePlaceImage.deleteMany({ where: { placeId } });
  if (rows.length) await db.villagePlaceImage.createMany({ data: rows.map((row) => ({ ...row, placeId })) });
}
