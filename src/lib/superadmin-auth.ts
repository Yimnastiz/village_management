import { cookies } from "next/headers";

export const SUPERADMIN_SESSION_COOKIE = "village_superadmin_session";
export const SUPERADMIN_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export type SuperAdminSession = {
  /** Never a User id; retained temporarily for legacy audit call sites. */
  id: null;
  role: "SUPERADMIN";
  actorType: "SUPERADMIN_ENV";
  issuedAt: number;
  expiresAt: number;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function secretKey() {
  const secret = process.env.SUPERADMIN_SESSION_SECRET?.trim();
  if (!secret) return null;
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function sign(payload: string) {
  const key = await secretKey();
  if (!key) return null;
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Buffer.from(signature).toString("base64url");
}

export function isSuperAdminConfigured() {
  return Boolean(process.env.SUPERADMIN_ACCESS_CODE?.trim() && process.env.SUPERADMIN_SESSION_SECRET?.trim());
}

export async function verifySuperAdminAccessCode(submittedCode: string) {
  const expected = process.env.SUPERADMIN_ACCESS_CODE?.trim();
  if (!expected || !submittedCode) return false;
  const submittedHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(submittedCode));
  const expectedHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(expected));
  const a = new Uint8Array(submittedHash);
  const b = new Uint8Array(expectedHash);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return difference === 0;
}

export async function createSuperAdminSession(): Promise<string | null> {
  if (!isSuperAdminConfigured()) return null;
  const issuedAt = Date.now();
  const payload: SuperAdminSession = { id: null, role: "SUPERADMIN", actorType: "SUPERADMIN_ENV", issuedAt, expiresAt: issuedAt + SUPERADMIN_SESSION_MAX_AGE_SECONDS * 1000 };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await sign(encodedPayload);
  return signature ? `${encodedPayload}.${signature}` : null;
}

export async function readSuperAdminSession(token: string | undefined | null): Promise<SuperAdminSession | null> {
  if (!token || !isSuperAdminConfigured()) return null;
  const [encodedPayload, signature, ...extra] = token.split(".");
  if (!encodedPayload || !signature || extra.length) return null;
  const key = await secretKey();
  if (!key) return null;
  const valid = await crypto.subtle.verify("HMAC", key, Buffer.from(signature, "base64url"), new TextEncoder().encode(encodedPayload));
  if (!valid) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SuperAdminSession;
    if (payload.id !== null || payload.role !== "SUPERADMIN" || payload.actorType !== "SUPERADMIN_ENV" || !Number.isFinite(payload.issuedAt) || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function readSuperAdminSessionFromServerCookies() {
  return readSuperAdminSession((await cookies()).get(SUPERADMIN_SESSION_COOKIE)?.value);
}

export const superAdminSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/superadmin",
  maxAge: SUPERADMIN_SESSION_MAX_AGE_SECONDS,
};

export async function clearSuperAdminSession() {
  (await cookies()).set(SUPERADMIN_SESSION_COOKIE, "", { ...superAdminSessionCookieOptions, maxAge: 0 });
}
