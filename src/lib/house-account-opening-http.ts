import { NextResponse, type NextRequest } from "next/server";
import {
  HouseAccountOpeningError,
  houseAccountOpeningErrorMessage,
} from "@/lib/house-account-opening-service";
import { ConfiguredVillageError } from "@/lib/configured-village";

export function emailOtpClientContext(request: NextRequest) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}

export function houseAccountOpeningProblemResponse(error: unknown): NextResponse {
  if (error instanceof ConfiguredVillageError) {
    return NextResponse.json({ error: "ระบบยังไม่ได้ตั้งค่าหมู่บ้านสำหรับรับคำขอ" }, { status: 503 });
  }
  if (!(error instanceof HouseAccountOpeningError)) {
    return NextResponse.json({ error: "ไม่สามารถดำเนินการคำขอเปิดบัญชีบ้านได้" }, { status: 500 });
  }
  const status = error.code === "REGISTRATION_DISABLED" ? 403
    : error.code === "MAINTENANCE_MODE" ? 503
      : error.code === "REQUEST_NOT_FOUND" || error.code === "CHALLENGE_MISMATCH" ? 404
        : error.code === "HOUSE_ALREADY_ACTIVE"
          || error.code === "HOUSE_REQUEST_ALREADY_PENDING"
          || error.code === "EMAIL_UNAVAILABLE"
          || error.code === "REQUEST_NOT_EDITABLE" ? 409
          : error.code === "RATE_LIMITED" || error.code === "RESEND_COOLDOWN" ? 429
            : error.code === "DELIVERY_FAILED" ? 502
              : 400;
  return NextResponse.json({
    error: houseAccountOpeningErrorMessage(error.code),
    code: error.code,
    ...(error.validationErrors.length ? { validationErrors: error.validationErrors } : {}),
  }, { status });
}
