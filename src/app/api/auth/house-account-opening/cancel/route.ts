import { NextRequest, NextResponse } from "next/server";
import {
  clearHouseOpeningAccessCookie,
  readHouseOpeningAccess,
} from "@/lib/house-account-opening-access";
import { houseAccountOpeningProblemResponse } from "@/lib/house-account-opening-http";
import {
  cancelHouseAccountOpening,
  HouseAccountOpeningError,
  houseAccountOpeningErrorMessage,
} from "@/lib/house-account-opening-service";

export async function POST(request: NextRequest) {
  const access = readHouseOpeningAccess(request);
  if (!access) {
    return houseAccountOpeningProblemResponse(new HouseAccountOpeningError(
      "REQUEST_NOT_FOUND",
      houseAccountOpeningErrorMessage("REQUEST_NOT_FOUND"),
    ));
  }
  try {
    await cancelHouseAccountOpening(access.requestId);
    const response = NextResponse.json({ ok: true });
    clearHouseOpeningAccessCookie(response);
    return response;
  } catch (error) {
    return houseAccountOpeningProblemResponse(error);
  }
}
