import { NextResponse, type NextRequest } from "next/server";
import {
  HOUSE_LOGIN_FLOW_COOKIE,
  createHouseLoginFlowToken,
  houseLoginFlowCookieOptions,
} from "@/lib/house-account-login-access";
import { ConfiguredVillageError } from "@/lib/configured-village";
import { HouseAccountLoginError } from "@/lib/house-account-login-service";

export function houseLoginClientContext(request: NextRequest) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}

export function setHouseLoginFlowCookie(
  response: NextResponse,
  flow: { flowId: string; expiresAt: Date },
): void {
  response.cookies.set({
    name: HOUSE_LOGIN_FLOW_COOKIE,
    value: createHouseLoginFlowToken(flow.flowId, flow.expiresAt),
    ...houseLoginFlowCookieOptions,
    maxAge: Math.max(1, Math.ceil((flow.expiresAt.getTime() - Date.now()) / 1_000)),
  });
}

export function clearHouseLoginFlowCookie(response: NextResponse): void {
  response.cookies.set({
    name: HOUSE_LOGIN_FLOW_COOKIE,
    value: "",
    ...houseLoginFlowCookieOptions,
    maxAge: 0,
  });
}

export function houseLoginProblemResponse(error: unknown): NextResponse {
  if (error instanceof ConfiguredVillageError) {
    return NextResponse.json({ error: "ระบบยังไม่ได้ตั้งค่าหมู่บ้านสำหรับเข้าสู่ระบบ" }, { status: 503 });
  }
  if (error instanceof HouseAccountLoginError) {
    const status = error.code === "RATE_LIMITED" ? 429
      : error.code === "FLOW_EXPIRED" ? 410
        : error.code === "FLOW_NOT_FOUND" ? 404
          : 401;
    return NextResponse.json({
      error: error.code === "RATE_LIMITED"
        ? "มีการขอรหัสบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่"
        : "ไม่สามารถดำเนินการเข้าสู่ระบบได้ กรุณาเริ่มใหม่",
    }, { status });
  }
  return NextResponse.json({ error: "ไม่สามารถดำเนินการเข้าสู่ระบบได้" }, { status: 500 });
}

export function publicHouseLoginFlow(flow: {
  flowId: string;
  maskedEmail: string;
  expiresAt: Date;
  resendAvailableAt: Date;
}) {
  return {
    ok: true,
    accepted: true,
    message: "หากข้อมูลถูกต้อง ระบบจะส่งรหัสยืนยันไปยังอีเมลที่ระบุ",
    flowId: flow.flowId,
    maskedEmail: flow.maskedEmail,
    expiresAt: flow.expiresAt.toISOString(),
    resendAvailableAt: flow.resendAvailableAt.toISOString(),
  };
}
