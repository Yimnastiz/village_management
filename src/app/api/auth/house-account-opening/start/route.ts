import { NextRequest, NextResponse } from "next/server";
import {
  assertHouseOpeningAccessConfiguration,
  setHouseOpeningAccessCookie,
} from "@/lib/house-account-opening-access";
import {
  emailOtpClientContext,
  houseAccountOpeningProblemResponse,
} from "@/lib/house-account-opening-http";
import { startHouseAccountOpening } from "@/lib/house-account-opening-service";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    houseId?: string;
    applicantFirstName?: string;
    applicantLastName?: string;
    contactPhone?: string;
    email?: string;
    privacyConsent?: boolean;
  } | null;
  try {
    assertHouseOpeningAccessConfiguration();
    const result = await startHouseAccountOpening({
      houseId: body?.houseId ?? "",
      applicantFirstName: body?.applicantFirstName ?? "",
      applicantLastName: body?.applicantLastName ?? "",
      contactPhone: body?.contactPhone ?? "",
      email: body?.email ?? "",
      privacyConsent: body?.privacyConsent === true,
    }, emailOtpClientContext(request));
    const response = NextResponse.json({
      ok: true,
      challengeId: result.challengeId,
      maskedEmail: result.maskedEmail,
      houseNumber: result.houseNumber,
      expiresAt: result.expiresAt.toISOString(),
      resendAvailableAt: result.resendAvailableAt.toISOString(),
    });
    setHouseOpeningAccessCookie(response, result.requestId);
    return response;
  } catch (error) {
    return houseAccountOpeningProblemResponse(error);
  }
}
