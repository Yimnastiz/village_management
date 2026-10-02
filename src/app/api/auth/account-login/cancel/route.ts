import { NextRequest, NextResponse } from "next/server";
import { accountLoginProblemResponse, clearAccountLoginFlowCookie } from "@/lib/account-login-http";
import { cancelAccountLogin } from "@/lib/account-login-service";
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { flowId?: string } | null;
  try { await cancelAccountLogin(request.headers, body?.flowId); const response = NextResponse.json({ ok: true }); clearAccountLoginFlowCookie(response); return response; }
  catch (error) { const response = accountLoginProblemResponse(error); clearAccountLoginFlowCookie(response); return response; }
}
