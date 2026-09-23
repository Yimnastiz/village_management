import {
  createHmac,
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import type { EmailOtpPurpose } from "@prisma/client";

const scrypt = promisify(scryptCallback);
const OTP_PATTERN = /^\d{6}$/;
const DERIVED_KEY_LENGTH = 32;

export function generateEmailOtp(
  secureRandomInt: (minimum: number, maximum: number) => number = randomInt,
): string {
  return secureRandomInt(0, 1_000_000).toString().padStart(6, "0");
}

function otpMaterial(input: {
  code: string;
  normalizedEmail: string;
  purpose: EmailOtpPurpose;
  secret: string;
}): string {
  return `${input.secret}\u0000${input.normalizedEmail}\u0000${input.purpose}\u0000${input.code}`;
}

export async function hashEmailOtp(input: {
  code: string;
  normalizedEmail: string;
  purpose: EmailOtpPurpose;
  secret: string;
  salt?: string;
}): Promise<{ codeHash: string; codeSalt: string }> {
  if (!OTP_PATTERN.test(input.code)) throw new Error("Email OTP must contain exactly six digits.");
  const codeSalt = input.salt ?? randomBytes(16).toString("base64url");
  const derived = await scrypt(otpMaterial(input), codeSalt, DERIVED_KEY_LENGTH) as Buffer;
  return { codeHash: derived.toString("base64url"), codeSalt };
}

export async function verifyEmailOtpHash(input: {
  code: string;
  normalizedEmail: string;
  purpose: EmailOtpPurpose;
  secret: string;
  codeHash: string;
  codeSalt: string;
}): Promise<boolean> {
  if (!OTP_PATTERN.test(input.code)) return false;
  const candidate = await hashEmailOtp({ ...input, salt: input.codeSalt });
  const expectedBuffer = Buffer.from(input.codeHash, "base64url");
  const candidateBuffer = Buffer.from(candidate.codeHash, "base64url");
  return expectedBuffer.length === candidateBuffer.length
    && timingSafeEqual(expectedBuffer, candidateBuffer);
}

export function hashEmailOtpAbuseContext(value: string | null | undefined, secret: string): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  return createHmac("sha256", secret).update(normalized).digest("base64url");
}
