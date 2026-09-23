import { NextRequest, NextResponse } from "next/server";
import { getSessionContextFromRequest } from "@/lib/access-control";
import {
  clearHouseAccountEmailFlowCookie,
  houseAccountEmailProblemResponse,
  readHouseAccountEmailFlow,
} from "@/lib/house-account-email-management-http";
import { cancelHouseAccountEmailAddition } from "@/lib/house-account-email-management-service";

export async function POST(request: NextRequest) {
  const session = await getSessionContextFromRequest(request);
  if (!session) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบอีกครั้ง" }, { status: 401 });
  try {
    await cancelHouseAccountEmailAddition(session, readHouseAccountEmailFlow(request, true));
    const response = NextResponse.json({ ok: true });
    clearHouseAccountEmailFlowCookie(response);
    return response;
  } catch (error) {
    const response = houseAccountEmailProblemResponse(error);
    clearHouseAccountEmailFlowCookie(response);
    return response;
  }
}
