import { NextRequest, NextResponse } from "next/server";
import { accountLoginClientContext, accountLoginProblemResponse, publicAccountLoginFlow, setAccountLoginFlowCookie } from "@/lib/account-login-http";
import { resendAccountLoginOtp } from "@/lib/account-login-service";
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { flowId?: string } | null;
  if (!body?.flowId) return NextResponse.json({ error: "ไม่พบขั้นตอนเข้าสู่ระบบ" }, { status: 400 });
  try { const flow = await resendAccountLoginOtp(request.headers, body.flowId, accountLoginClientContext(request)); const response = NextResponse.json(publicAccountLoginFlow(flow)); setAccountLoginFlowCookie(response, flow); return response; }
  catch (error) { return accountLoginProblemResponse(error); }
}
