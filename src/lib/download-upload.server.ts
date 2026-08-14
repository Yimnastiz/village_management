import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getDownloadExtension, isAllowedDownloadFile } from "@/lib/download-upload";

const KEY_PATTERN = /^downloads\/([a-zA-Z0-9_-]+)\/([a-f0-9-]{36})\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|jpg|jpeg|png)$/;
const bucket = process.env.PLACE_UPLOAD_S3_BUCKET;
const s3 = bucket ? new S3Client({
  region: process.env.PLACE_UPLOAD_S3_REGION || "auto",
  endpoint: process.env.PLACE_UPLOAD_S3_ENDPOINT || undefined,
  forcePathStyle: process.env.PLACE_UPLOAD_S3_FORCE_PATH_STYLE === "true",
  ...(process.env.PLACE_UPLOAD_S3_ACCESS_KEY_ID && process.env.PLACE_UPLOAD_S3_SECRET_ACCESS_KEY ? { credentials: { accessKeyId: process.env.PLACE_UPLOAD_S3_ACCESS_KEY_ID, secretAccessKey: process.env.PLACE_UPLOAD_S3_SECRET_ACCESS_KEY } } : {}),
}) : null;

function secret() {
  return process.env.DOWNLOAD_UPLOAD_SECRET || process.env.PLACE_UPLOAD_SECRET || process.env.BETTER_AUTH_SECRET || "development-download-upload-secret";
}

function absolutePath(fileKey: string) {
  if (!KEY_PATTERN.test(fileKey)) throw new Error("INVALID_DOWNLOAD_FILE_KEY");
  return path.join(process.cwd(), "data", "uploads", ...fileKey.split("/"));
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createDownloadUploadToken(fileKey: string, villageId: string, uploaderId: string) {
  const payload = Buffer.from(JSON.stringify({ fileKey, villageId, uploaderId }), "utf8").toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyDownloadUploadToken(token: string | undefined, fileKey: string, villageId: string, uploaderId?: string) {
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

export async function saveDownloadUpload(bytes: Uint8Array, fileName: string, mimeType: string, villageId: string) {
  const extension = getDownloadExtension(fileName);
  if (!isAllowedDownloadFile(fileName, mimeType)) throw new Error("INVALID_DOWNLOAD_TYPE");
  const fileKey = `downloads/${villageId}/${crypto.randomUUID()}.${extension}`;
  if (s3 && bucket) {
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: fileKey, Body: bytes, ContentType: mimeType, ContentDisposition: "attachment" }));
  } else {
    const target = absolutePath(fileKey);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: "wx" });
  }
  return { fileKey, url: `/api/downloads/storage?key=${encodeURIComponent(fileKey)}` };
}

export async function readDownloadUpload(fileKey: string) {
  if (!KEY_PATTERN.test(fileKey)) return null;
  try {
    if (s3 && bucket) {
      const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: fileKey }));
      if (!object.Body) return null;
      return { bytes: await object.Body.transformToByteArray(), mimeType: object.ContentType || "application/octet-stream" };
    }
    return { bytes: await readFile(absolutePath(fileKey)), mimeType: "application/octet-stream" };
  } catch { return null; }
}

export async function deleteDownloadUploads(fileKeys: readonly string[]) {
  await Promise.allSettled(fileKeys.filter((key) => KEY_PATTERN.test(key)).map((key) => s3 && bucket ? s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })) : unlink(absolutePath(key))));
}
