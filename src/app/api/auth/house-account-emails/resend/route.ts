import { NextRequest, NextResponse } from "next/server";
import { getSessionContextFromRequest } from "@/lib/access-control";
import {
  emailManagementClientContext,
  houseAccountEmailProblemResponse,
  publicHouseAccountEmailFlow,
  readHouseAccountEmailFlow,
  setHouseAccountEmailFlowCookie,
} from "@/lib/house-account-email-management-http";
import { resendHouseAccountEmailAddition } from "@/lib/house-account-email-management-service";

export async function POST(request: NextRequest) {
  const session = await getSessionContextFromRequest(request);
  if (!session) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบอีกครั้ง" }, { status: 401 });
  try {
    const flow = await resendHouseAccountEmailAddition(
      session,
      readHouseAccountEmailFlow(request),
      emailManagementClientContext(request),
    );
    const response = NextResponse.json(publicHouseAccountEmailFlow(flow));
    setHouseAccountEmailFlowCookie(response, {
      session,
      residentHouseAccountId: flow.context.residentHouseAccountId,
      accountEmailId: flow.accountEmail.id,
      challengeId: flow.challengeId,
      expiresAt: flow.expiresAt,
    });
    return response;
  } catch (error) {
    return houseAccountEmailProblemResponse(error);
  }
}
