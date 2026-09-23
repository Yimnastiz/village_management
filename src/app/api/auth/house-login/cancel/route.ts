import { NextRequest, NextResponse } from "next/server";
import {
  clearHouseLoginFlowCookie,
  houseLoginProblemResponse,
} from "@/lib/house-account-login-http";
import { cancelHouseAccountLogin } from "@/lib/house-account-login-service";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { flowId?: string } | null;
  try {
    await cancelHouseAccountLogin(request.headers, body?.flowId);
    const response = NextResponse.json({ ok: true });
    clearHouseLoginFlowCookie(response);
    return response;
  } catch (error) {
    const response = houseLoginProblemResponse(error);
    clearHouseLoginFlowCookie(response);
    return response;
  }
}
