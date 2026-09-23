import { createHmac, timingSafeEqual } from "node:crypto";

export const HOUSE_ACCOUNT_EMAIL_FLOW_COOKIE = "house_account_email_flow";
export const HOUSE_ACCOUNT_EMAIL_FLOW_COOKIE_PATH = "/api/auth/house-account-emails";

export type HouseAccountEmailFlow = {
  version: 1;
  authSessionId: string;
  userId: string;
  residentHouseAccountId: string;
  accountEmailId: string;
  challengeId: string;
  expiresAt: number;
};

function secret(): string {
  const value = process.env.HOUSE_ACCOUNT_EMAIL_FLOW_SECRET?.trim()
    || process.env.BETTER_AUTH_SECRET?.trim();
  if (!value) throw new Error("HOUSE_ACCOUNT_EMAIL_FLOW_SECRET or BETTER_AUTH_SECRET is required.");
  if (process.env.NODE_ENV === "production" && value.length < 32) {
    throw new Error("HOUSE_ACCOUNT_EMAIL_FLOW_SECRET must be at least 32 characters in production.");
  }
  return value;
}

function signature(encoded: string): string {
  return createHmac("sha256", secret())
    .update(`house-account-email-management\u0000${encoded}`)
    .digest("base64url");
}

export function createHouseAccountEmailFlowToken(flow: Omit<HouseAccountEmailFlow, "version">): string {
  const encoded = Buffer.from(JSON.stringify({ version: 1, ...flow } satisfies HouseAccountEmailFlow)).toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}

export function verifyHouseAccountEmailFlowToken(
  value: string | null | undefined,
  options: { now?: Date; allowExpired?: boolean } = {},
): HouseAccountEmailFlow | null {
  if (!value) return null;
  const [encoded, suppliedSignature, extra] = value.split(".");
  if (!encoded || !suppliedSignature || extra) return null;
  const expected = Buffer.from(signature(encoded), "base64url");
  const supplied = Buffer.from(suppliedSignature, "base64url");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<HouseAccountEmailFlow>;
    if (
      payload.version !== 1
      || typeof payload.authSessionId !== "string"
      || typeof payload.userId !== "string"
      || typeof payload.residentHouseAccountId !== "string"
      || typeof payload.accountEmailId !== "string"
      || typeof payload.challengeId !== "string"
      || typeof payload.expiresAt !== "number"
      || (!options.allowExpired && payload.expiresAt <= (options.now ?? new Date()).getTime())
    ) return null;
    return payload as HouseAccountEmailFlow;
  } catch {
    return null;
  }
}

export function readHouseAccountEmailFlowCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator).trim() !== HOUSE_ACCOUNT_EMAIL_FLOW_COOKIE) continue;
    return decodeURIComponent(item.slice(separator + 1).trim());
  }
  return null;
}

export const houseAccountEmailFlowCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: HOUSE_ACCOUNT_EMAIL_FLOW_COOKIE_PATH,
};
