import { NextRequest, NextResponse } from "next/server";
import { getActiveAuthRedirectPathFromRequest } from "@/lib/access-control";
import {
  houseLoginClientContext,
  houseLoginProblemResponse,
  publicHouseLoginFlow,
  setHouseLoginFlowCookie,
} from "@/lib/house-account-login-http";
import { startHouseAccountLogin } from "@/lib/house-account-login-service";

export async function POST(request: NextRequest) {
  const landingPath = await getActiveAuthRedirectPathFromRequest(request);
  if (landingPath) {
    return NextResponse.json({ error: "มีการเข้าสู่ระบบอยู่แล้ว", landingPath }, { status: 409 });
  }
  const body = (await request.json().catch(() => null)) as {
    houseNumber?: string;
    email?: string;
    callbackUrl?: string | null;
  } | null;
  try {
    const flow = await startHouseAccountLogin({
      houseNumber: body?.houseNumber ?? "",
      email: body?.email ?? "",
      callbackUrl: body?.callbackUrl,
    }, houseLoginClientContext(request));
    const response = NextResponse.json(publicHouseLoginFlow(flow));
    setHouseLoginFlowCookie(response, flow);
    return response;
  } catch (error) {
    return houseLoginProblemResponse(error);
  }
}
