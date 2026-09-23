import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export const HOUSE_OPENING_ACCESS_COOKIE = "house_opening_access";
export const HOUSE_OPENING_ACCESS_TTL_SECONDS = 30 * 60;

type AccessPayload = {
  version: 1;
  requestId: string;
  expiresAt: number;
};

function accessSecret(
  environment: Record<string, string | undefined> = process.env,
  nodeEnvironment: string = process.env.NODE_ENV ?? "development",
): string {
  const explicit = environment.HOUSE_ACCOUNT_OPENING_ACCESS_SECRET?.trim();
  const fallback = environment.BETTER_AUTH_SECRET?.trim();
  const secret = explicit || (nodeEnvironment === "production" ? "" : fallback);
  if (!secret) {
    throw new Error(
      nodeEnvironment === "production"
        ? "HOUSE_ACCOUNT_OPENING_ACCESS_SECRET is required in production."
        : "HOUSE_ACCOUNT_OPENING_ACCESS_SECRET or BETTER_AUTH_SECRET is required.",
    );
  }
  if (nodeEnvironment === "production" && secret.length < 32) {
    throw new Error("HOUSE_ACCOUNT_OPENING_ACCESS_SECRET must be at least 32 characters in production.");
  }
  return secret;
}

export function assertHouseOpeningAccessConfiguration(): void {
  accessSecret();
}

function signature(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`house-account-opening-access\u0000${encodedPayload}`)
    .digest("base64url");
}

export function createHouseOpeningAccessToken(
  requestId: string,
  now = new Date(),
  environment?: Record<string, string | undefined>,
  nodeEnvironment?: string,
): string {
  const payload: AccessPayload = {
    version: 1,
    requestId,
    expiresAt: now.getTime() + HOUSE_OPENING_ACCESS_TTL_SECONDS * 1_000,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${signature(encodedPayload, accessSecret(environment, nodeEnvironment))}`;
}

export function verifyHouseOpeningAccessToken(
  token: string | null | undefined,
  now = new Date(),
  environment?: Record<string, string | undefined>,
  nodeEnvironment?: string,
): { requestId: string; expiresAt: Date } | null {
  if (!token) return null;
  const [encodedPayload, providedSignature, extra] = token.split(".");
  if (!encodedPayload || !providedSignature || extra) return null;
  const expectedSignature = signature(encodedPayload, accessSecret(environment, nodeEnvironment));
  const provided = Buffer.from(providedSignature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<AccessPayload>;
    if (
      payload.version !== 1
      || typeof payload.requestId !== "string"
      || !payload.requestId
      || typeof payload.expiresAt !== "number"
      || !Number.isSafeInteger(payload.expiresAt)
      || payload.expiresAt <= now.getTime()
    ) return null;
    return { requestId: payload.requestId, expiresAt: new Date(payload.expiresAt) };
  } catch {
    return null;
  }
}

export function setHouseOpeningAccessCookie(
  response: NextResponse,
  requestId: string,
  now = new Date(),
): void {
  response.cookies.set({
    name: HOUSE_OPENING_ACCESS_COOKIE,
    value: createHouseOpeningAccessToken(requestId, now),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/house-account-opening",
    maxAge: HOUSE_OPENING_ACCESS_TTL_SECONDS,
  });
}

export function clearHouseOpeningAccessCookie(response: NextResponse): void {
  response.cookies.set({
    name: HOUSE_OPENING_ACCESS_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/house-account-opening",
    maxAge: 0,
  });
}

export function readHouseOpeningAccess(request: NextRequest): { requestId: string; expiresAt: Date } | null {
  return verifyHouseOpeningAccessToken(request.cookies.get(HOUSE_OPENING_ACCESS_COOKIE)?.value);
}
