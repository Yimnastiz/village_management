import { NextRequest, NextResponse } from "next/server";
import { getSessionContextFromRequest } from "@/lib/access-control";
import { houseAccountEmailProblemResponse } from "@/lib/house-account-email-management-http";
import { removeHouseAccountEmail } from "@/lib/house-account-email-management-service";
import { expireSessionCookies } from "@/lib/session-cookie";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> },
) {
  const session = await getSessionContextFromRequest(request);
  if (!session) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบอีกครั้ง" }, { status: 401 });
  const { emailId } = await params;
  try {
    const result = await removeHouseAccountEmail(session, emailId);
    const response = NextResponse.json({ ok: true, ...result });
    if (result.currentSessionRevoked) expireSessionCookies(response);
    return response;
  } catch (error) {
    return houseAccountEmailProblemResponse(error);
  }
}
