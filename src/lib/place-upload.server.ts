import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const KEY_PATTERN = /^places\/([a-zA-Z0-9_-]+)\/([a-f0-9-]{36})\.(jpg|png|webp)$/;
const MIME_EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const bucket = process.env.PLACE_UPLOAD_S3_BUCKET;
const s3 = bucket ? new S3Client({
  region: process.env.PLACE_UPLOAD_S3_REGION || "auto",
  endpoint: process.env.PLACE_UPLOAD_S3_ENDPOINT || undefined,
  forcePathStyle: process.env.PLACE_UPLOAD_S3_FORCE_PATH_STYLE === "true",
  ...(process.env.PLACE_UPLOAD_S3_ACCESS_KEY_ID && process.env.PLACE_UPLOAD_S3_SECRET_ACCESS_KEY ? { credentials: { accessKeyId: process.env.PLACE_UPLOAD_S3_ACCESS_KEY_ID, secretAccessKey: process.env.PLACE_UPLOAD_S3_SECRET_ACCESS_KEY } } : {}),
}) : null;

function secret() {
  return process.env.PLACE_UPLOAD_SECRET || process.env.BETTER_AUTH_SECRET || "development-place-upload-secret";
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createPlaceUploadToken(fileKey: string, villageId: string, uploaderId: string) {
  const payload = Buffer.from(JSON.stringify({ fileKey, villageId, uploaderId }), "utf8").toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyPlaceUploadToken(token: string | undefined, fileKey: string, villageId: string, uploaderId?: string) {
  if (!token) return false;
  const [payload, supplied] = token.split(".");
  if (!payload || !supplied) return false;
  const expected = signature(payload);
  if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return false;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    return value.fileKey === fileKey && value.villageId === villageId && typeof value.uploaderId === "string" && (!uploaderId || value.uploaderId === uploaderId);
  } catch { return false; }
}

export function validateImageBytes(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return mimeType === "image/webp" && Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" && Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP";
}

function absolutePath(fileKey: string) {
  if (!KEY_PATTERN.test(fileKey)) throw new Error("INVALID_FILE_KEY");
  return path.join(process.cwd(), "data", "uploads", ...fileKey.split("/"));
}

export async function savePlaceUpload(bytes: Uint8Array, mimeType: string, villageId: string) {
  const extension = MIME_EXTENSIONS[mimeType];
  if (!extension) throw new Error("INVALID_IMAGE_TYPE");
  const fileKey = `places/${villageId}/${crypto.randomUUID()}.${extension}`;
  if (s3 && bucket) {
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: fileKey, Body: bytes, ContentType: mimeType, CacheControl: "public, max-age=31536000, immutable" }));
    return { fileKey, url: `/api/places/images?key=${encodeURIComponent(fileKey)}` };
  }
  const target = absolutePath(fileKey);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes, { flag: "wx" });
  return { fileKey, url: `/api/places/images?key=${encodeURIComponent(fileKey)}` };
}

export async function readPlaceUpload(fileKey: string) {
  const match = KEY_PATTERN.exec(fileKey);
  if (!match) return null;
  try {
    if (s3 && bucket) {
      const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: fileKey }));
      if (!object.Body) return null;
      return { bytes: await object.Body.transformToByteArray(), mimeType: object.ContentType || (match[3] === "jpg" ? "image/jpeg" : `image/${match[3]}`) };
    }
    const bytes = await readFile(absolutePath(fileKey));
    const mimeType = match[3] === "jpg" ? "image/jpeg" : `image/${match[3]}`;
    return { bytes, mimeType };
  } catch { return null; }
}

export async function deletePlaceUploads(fileKeys: readonly string[]) {
  await Promise.allSettled(fileKeys.filter((key) => KEY_PATTERN.test(key)).map((key) => s3 && bucket ? s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })) : unlink(absolutePath(key))));
}
