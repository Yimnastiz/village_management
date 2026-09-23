import { NextRequest, NextResponse } from "next/server";
import {
  houseLoginClientContext,
  houseLoginProblemResponse,
  publicHouseLoginFlow,
  setHouseLoginFlowCookie,
} from "@/lib/house-account-login-http";
import { resendHouseAccountLoginOtp } from "@/lib/house-account-login-service";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { flowId?: string } | null;
  if (!body?.flowId) return NextResponse.json({ error: "ไม่พบขั้นตอนเข้าสู่ระบบ" }, { status: 400 });
  try {
    const flow = await resendHouseAccountLoginOtp(
      request.headers,
      body.flowId,
      houseLoginClientContext(request),
    );
    const response = NextResponse.json(publicHouseLoginFlow(flow));
    setHouseLoginFlowCookie(response, flow);
    return response;
  } catch (error) {
    return houseLoginProblemResponse(error);
  }
}
