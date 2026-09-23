import { NextRequest, NextResponse } from "next/server";
import { readHouseOpeningAccess } from "@/lib/house-account-opening-access";
import { houseAccountOpeningProblemResponse } from "@/lib/house-account-opening-http";
import {
  HouseAccountOpeningError,
  houseAccountOpeningErrorMessage,
  verifyHouseAccountOpeningEmail,
} from "@/lib/house-account-opening-service";

export async function POST(request: NextRequest) {
  const access = readHouseOpeningAccess(request);
  if (!access) {
    return houseAccountOpeningProblemResponse(new HouseAccountOpeningError(
      "REQUEST_NOT_FOUND",
      houseAccountOpeningErrorMessage("REQUEST_NOT_FOUND"),
    ));
  }
  const body = (await request.json().catch(() => null)) as {
    challengeId?: string;
    code?: string;
  } | null;
  if (!body?.challengeId || !/^\d{6}$/.test(body.code ?? "")) {
    return NextResponse.json({ error: "กรุณากรอกรหัสยืนยัน 6 หลัก" }, { status: 400 });
  }
  try {
    const result = await verifyHouseAccountOpeningEmail(
      access.requestId,
      body.challengeId,
      body.code!,
    );
    return NextResponse.json({
      ok: true,
      status: "PENDING_REVIEW",
      ...result,
      requestedAt: result.requestedAt.toISOString(),
    });
  } catch (error) {
    return houseAccountOpeningProblemResponse(error);
  }
}
