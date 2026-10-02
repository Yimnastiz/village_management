import { NextRequest, NextResponse } from "next/server";
import { getActiveAuthRedirectPathFromRequest } from "@/lib/access-control";
import { accountLoginClientContext, accountLoginProblemResponse, publicAccountLoginFlow, setAccountLoginFlowCookie } from "@/lib/account-login-http";
import { startAccountLogin } from "@/lib/account-login-service";

export async function POST(request: NextRequest) {
  const landingPath = await getActiveAuthRedirectPathFromRequest(request);
  if (landingPath) return NextResponse.json({ error: "มีการเข้าสู่ระบบอยู่แล้ว", landingPath }, { status: 409 });
  const body = await request.json().catch(() => null) as { email?: string; callbackUrl?: string | null } | null;
  try {
    const flow = await startAccountLogin({ email: body?.email ?? "", callbackUrl: body?.callbackUrl }, accountLoginClientContext(request));
    const response = NextResponse.json(publicAccountLoginFlow(flow));
    setAccountLoginFlowCookie(response, flow);
    return response;
  } catch (error) { return accountLoginProblemResponse(error); }
}
