import { NextResponse, type NextRequest } from "next/server";
import { ACCOUNT_LOGIN_FLOW_COOKIE, accountLoginFlowCookieOptions, createAccountLoginFlowToken } from "@/lib/account-login-access";
import { AccountLoginError } from "@/lib/account-login-service";
import { ConfiguredVillageError } from "@/lib/configured-village";

export function accountLoginClientContext(request: NextRequest) {
  return { ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"), userAgent: request.headers.get("user-agent") };
}
export function setAccountLoginFlowCookie(response: NextResponse, flow: { flowId: string; expiresAt: Date }): void {
  response.cookies.set({ name: ACCOUNT_LOGIN_FLOW_COOKIE, value: createAccountLoginFlowToken(flow.flowId, flow.expiresAt), ...accountLoginFlowCookieOptions, maxAge: Math.max(1, Math.ceil((flow.expiresAt.getTime() - Date.now()) / 1_000)) });
}
export function clearAccountLoginFlowCookie(response: NextResponse): void {
  response.cookies.set({ name: ACCOUNT_LOGIN_FLOW_COOKIE, value: "", ...accountLoginFlowCookieOptions, maxAge: 0 });
}
export function accountLoginProblemResponse(error: unknown): NextResponse {
  if (error instanceof ConfiguredVillageError) return NextResponse.json({ error: "ระบบยังไม่ได้ตั้งค่าหมู่บ้านสำหรับเข้าสู่ระบบ" }, { status: 503 });
  if (error instanceof AccountLoginError) {
    const status = error.code === "INVALID_EMAIL" ? 400 : error.code === "RATE_LIMITED" ? 429 : error.code === "FLOW_EXPIRED" ? 410 : error.code === "FLOW_NOT_FOUND" ? 404 : 401;
    const message = error.code === "INVALID_EMAIL" ? "กรุณากรอกอีเมลให้ถูกต้อง" : error.code === "RATE_LIMITED" ? "มีการขอรหัสบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" : "ไม่สามารถดำเนินการเข้าสู่ระบบได้ กรุณาเริ่มใหม่";
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ error: "ไม่สามารถดำเนินการเข้าสู่ระบบได้" }, { status: 500 });
}
export function publicAccountLoginFlow(flow: { flowId: string; maskedEmail: string; expiresAt: Date; resendAvailableAt: Date }) {
  return { ok: true, accepted: true, message: "หากอีเมลนี้ใช้เข้าสู่ระบบได้ ระบบจะส่งรหัสยืนยันไปยังอีเมลที่ระบุ", flowId: flow.flowId, maskedEmail: flow.maskedEmail, expiresAt: flow.expiresAt.toISOString(), resendAvailableAt: flow.resendAvailableAt.toISOString() };
}
