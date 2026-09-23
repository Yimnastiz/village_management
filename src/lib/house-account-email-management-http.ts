import { NextResponse, type NextRequest } from "next/server";
import type { SessionContext } from "@/lib/access-control";
import {
  createHouseAccountEmailFlowToken,
  HOUSE_ACCOUNT_EMAIL_FLOW_COOKIE,
  houseAccountEmailFlowCookieOptions,
  readHouseAccountEmailFlowCookie,
  verifyHouseAccountEmailFlowToken,
} from "@/lib/house-account-email-access";
import {
  HouseAccountEmailManagementError,
  houseAccountEmailManagementMessage,
} from "@/lib/house-account-email-management-service";

export function emailManagementClientContext(request: NextRequest) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}

export function readHouseAccountEmailFlow(request: NextRequest, allowExpired = false) {
  return verifyHouseAccountEmailFlowToken(
    readHouseAccountEmailFlowCookie(request.headers.get("cookie")),
    { allowExpired },
  );
}

export function setHouseAccountEmailFlowCookie(
  response: NextResponse,
  input: {
    session: SessionContext;
    residentHouseAccountId: string;
    accountEmailId: string;
    challengeId: string;
    expiresAt: Date;
  },
) {
  response.cookies.set({
    name: HOUSE_ACCOUNT_EMAIL_FLOW_COOKIE,
    value: createHouseAccountEmailFlowToken({
      authSessionId: input.session.authSessionId,
      userId: input.session.id,
      residentHouseAccountId: input.residentHouseAccountId,
      accountEmailId: input.accountEmailId,
      challengeId: input.challengeId,
      expiresAt: input.expiresAt.getTime(),
    }),
    ...houseAccountEmailFlowCookieOptions,
    maxAge: Math.max(1, Math.ceil((input.expiresAt.getTime() - Date.now()) / 1_000)),
  });
}

export function clearHouseAccountEmailFlowCookie(response: NextResponse) {
  response.cookies.set({
    name: HOUSE_ACCOUNT_EMAIL_FLOW_COOKIE,
    value: "",
    ...houseAccountEmailFlowCookieOptions,
    maxAge: 0,
  });
}

export function houseAccountEmailProblemResponse(error: unknown): NextResponse {
  if (error instanceof HouseAccountEmailManagementError) {
    const status = error.code === "UNAUTHORIZED" ? 401
      : error.code === "FORBIDDEN" ? 403
        : error.code === "FLOW_NOT_FOUND" || error.code === "EMAIL_NOT_FOUND" ? 404
          : error.code === "FLOW_EXPIRED" ? 410
            : error.code === "RATE_LIMITED" ? 429
              : error.code === "DELIVERY_FAILED" ? 502
                : error.code === "INVALID_EMAIL" || error.code === "INVALID_CODE" ? 400
                  : 409;
    return NextResponse.json({ error: houseAccountEmailManagementMessage(error.code), code: error.code }, { status });
  }
  console.error("[house-account-email-management] request failed", {
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  return NextResponse.json({ error: "ไม่สามารถจัดการอีเมลได้ กรุณาลองใหม่" }, { status: 500 });
}

export function publicHouseAccountEmailFlow(flow: {
  accountEmail: { email: string };
  expiresAt: Date;
  resendAvailableAt: Date;
}) {
  return {
    ok: true,
    maskedEmail: flow.accountEmail.email.replace(/^(.{1,2}).*(@.*)$/u, "$1•••$2"),
    expiresAt: flow.expiresAt.toISOString(),
    resendAvailableAt: flow.resendAvailableAt.toISOString(),
  };
}
