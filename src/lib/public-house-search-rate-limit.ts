import { hashEmailOtpAbuseContext } from "@/lib/email/email-otp-crypto";
import { readEmailOtpConfig } from "@/lib/email/email-otp-config";

const WINDOW_MS = 60_000;
const MAX_SEARCHES_PER_WINDOW = 30;
const buckets = new Map<string, { startedAt: number; count: number }>();

export function allowPublicHouseSearch(clientAddress: string | null, now = Date.now()): boolean {
  const secret = readEmailOtpConfig().hashSecret;
  const key = hashEmailOtpAbuseContext(clientAddress || "unknown", secret)!;
  const existing = buckets.get(key);
  if (!existing || now - existing.startedAt >= WINDOW_MS) {
    buckets.set(key, { startedAt: now, count: 1 });
    if (buckets.size > 5_000) {
      for (const [bucketKey, bucket] of buckets) {
        if (now - bucket.startedAt >= WINDOW_MS) buckets.delete(bucketKey);
      }
    }
    return true;
  }
  if (existing.count >= MAX_SEARCHES_PER_WINDOW) return false;
  existing.count += 1;
  return true;
}
