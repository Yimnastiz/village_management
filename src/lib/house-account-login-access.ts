import { createHmac, timingSafeEqual } from "node:crypto";

export const HOUSE_LOGIN_FLOW_COOKIE = "house_login_flow";
export const HOUSE_LOGIN_FLOW_TTL_SECONDS = 5 * 60;
export const HOUSE_LOGIN_FLOW_COOKIE_PATH = "/api/auth";

type FlowPayload = {
  version: 1;
  flowId: string;
  expiresAt: number;
};

function secret(): string {
  const value = process.env.HOUSE_ACCOUNT_LOGIN_FLOW_SECRET?.trim()
    || process.env.BETTER_AUTH_SECRET?.trim();
  if (!value) throw new Error("HOUSE_ACCOUNT_LOGIN_FLOW_SECRET or BETTER_AUTH_SECRET is required.");
  if (process.env.NODE_ENV === "production" && value.length < 32) {
    throw new Error("HOUSE_ACCOUNT_LOGIN_FLOW_SECRET must be at least 32 characters in production.");
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret())
    .update(`house-account-login-flow\u0000${payload}`)
    .digest("base64url");
}

export function createHouseLoginFlowToken(flowId: string, expiresAt: Date): string {
  const encoded = Buffer.from(JSON.stringify({
    version: 1,
    flowId,
    expiresAt: expiresAt.getTime(),
  } satisfies FlowPayload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyHouseLoginFlowToken(
  value: string | null | undefined,
  now = new Date(),
): { flowId: string; expiresAt: Date } | null {
  if (!value) return null;
  const [encoded, suppliedSignature, extra] = value.split(".");
  if (!encoded || !suppliedSignature || extra) return null;
  const expected = Buffer.from(sign(encoded), "base64url");
  const supplied = Buffer.from(suppliedSignature, "base64url");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<FlowPayload>;
    if (
      payload.version !== 1
      || typeof payload.flowId !== "string"
      || !payload.flowId
      || typeof payload.expiresAt !== "number"
      || payload.expiresAt <= now.getTime()
    ) return null;
    return { flowId: payload.flowId, expiresAt: new Date(payload.expiresAt) };
  } catch {
    return null;
  }
}

export function readHouseLoginFlowCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    const name = item.slice(0, separator).trim();
    if (name !== HOUSE_LOGIN_FLOW_COOKIE) continue;
    return decodeURIComponent(item.slice(separator + 1).trim());
  }
  return null;
}

export const houseLoginFlowCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: HOUSE_LOGIN_FLOW_COOKIE_PATH,
};
