import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_REQUEST, MAX_TOTAL_IMAGE_DATA_URL_BYTES } from "@/lib/image-constraints";

const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
export { MAX_IMAGE_BYTES, MAX_IMAGES_PER_REQUEST, MAX_TOTAL_IMAGE_DATA_URL_BYTES };

export function isSafeImageSource(value: string): boolean {
  const source = value.trim();
  if (/^https?:\/\//i.test(source)) return true;
  const match = DATA_URL_PATTERN.exec(source);
  if (!match) return false;
  const payload = match[2];
  if (payload.length % 4 !== 0) return false;
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  const decodedBytes = (payload.length * 3) / 4 - padding;
  if (decodedBytes <= 0 || decodedBytes > MAX_IMAGE_BYTES) return false;
  const bytes = Buffer.from(payload, "base64");
  const mime = match[1];
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return mime === "image/webp" && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}

export function areSafeImageSources(values: readonly string[]): boolean {
  return values.length <= MAX_IMAGES_PER_REQUEST
    && values.reduce((total, value) => total + Buffer.byteLength(value, "utf8"), 0) <= MAX_TOTAL_IMAGE_DATA_URL_BYTES
    && values.every(isSafeImageSource);
}

export function hasSafeTotalImageDataSize(values: readonly string[]): boolean {
  return values.reduce((total, value) => total + Buffer.byteLength(value, "utf8"), 0) <= MAX_TOTAL_IMAGE_DATA_URL_BYTES;
}
