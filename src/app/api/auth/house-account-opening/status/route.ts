import { NextRequest, NextResponse } from "next/server";
import { readHouseOpeningAccess } from "@/lib/house-account-opening-access";
import { houseAccountOpeningProblemResponse } from "@/lib/house-account-opening-http";
import {
  getHouseAccountOpeningStatus,
  HouseAccountOpeningError,
  houseAccountOpeningErrorMessage,
} from "@/lib/house-account-opening-service";

export async function GET(request: NextRequest) {
  const access = readHouseOpeningAccess(request);
  if (!access) {
    return houseAccountOpeningProblemResponse(new HouseAccountOpeningError(
      "REQUEST_NOT_FOUND",
      houseAccountOpeningErrorMessage("REQUEST_NOT_FOUND"),
    ));
  }
  try {
    const result = await getHouseAccountOpeningStatus(access.requestId);
    return NextResponse.json({
      ok: true,
      ...result,
      requestedAt: result.requestedAt?.toISOString() ?? null,
      expiresAt: result.expiresAt?.toISOString() ?? null,
      resendAvailableAt: result.resendAvailableAt?.toISOString() ?? null,
    });
  } catch (error) {
    return houseAccountOpeningProblemResponse(error);
  }
}
