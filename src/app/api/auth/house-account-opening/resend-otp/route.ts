import { NextRequest, NextResponse } from "next/server";
import { readHouseOpeningAccess } from "@/lib/house-account-opening-access";
import {
  emailOtpClientContext,
  houseAccountOpeningProblemResponse,
} from "@/lib/house-account-opening-http";
import {
  HouseAccountOpeningError,
  houseAccountOpeningErrorMessage,
  resendHouseAccountOpeningOtp,
} from "@/lib/house-account-opening-service";

export async function POST(request: NextRequest) {
  const access = readHouseOpeningAccess(request);
  if (!access) {
    return houseAccountOpeningProblemResponse(new HouseAccountOpeningError(
      "REQUEST_NOT_FOUND",
      houseAccountOpeningErrorMessage("REQUEST_NOT_FOUND"),
    ));
  }
  const body = (await request.json().catch(() => null)) as { challengeId?: string } | null;
  if (!body?.challengeId) return NextResponse.json({ error: "ไม่พบรหัสคำขอยืนยัน" }, { status: 400 });
  try {
    const result = await resendHouseAccountOpeningOtp(
      access.requestId,
      body.challengeId,
      emailOtpClientContext(request),
    );
    return NextResponse.json({
      ok: true,
      challengeId: result.challengeId,
      maskedEmail: result.maskedEmail,
      expiresAt: result.expiresAt.toISOString(),
      resendAvailableAt: result.resendAvailableAt.toISOString(),
    });
  } catch (error) {
    return houseAccountOpeningProblemResponse(error);
  }
}
