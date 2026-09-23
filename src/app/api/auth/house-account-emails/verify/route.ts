import { NextRequest, NextResponse } from "next/server";
import { getSessionContextFromRequest } from "@/lib/access-control";
import {
  clearHouseAccountEmailFlowCookie,
  houseAccountEmailProblemResponse,
  readHouseAccountEmailFlow,
} from "@/lib/house-account-email-management-http";
import { verifyHouseAccountEmailAddition } from "@/lib/house-account-email-management-service";

export async function POST(request: NextRequest) {
  const session = await getSessionContextFromRequest(request);
  if (!session) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบอีกครั้ง" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  if (!/^\d{6}$/u.test(body?.code ?? "")) {
    return NextResponse.json({ error: "กรุณากรอกรหัสยืนยัน 6 หลัก" }, { status: 400 });
  }
  try {
    const result = await verifyHouseAccountEmailAddition(session, readHouseAccountEmailFlow(request), body!.code!);
    const response = NextResponse.json({ ok: true, email: result?.email });
    clearHouseAccountEmailFlowCookie(response);
    return response;
  } catch (error) {
    return houseAccountEmailProblemResponse(error);
  }
}
