import { NextRequest, NextResponse } from "next/server";
import {
  computeLandingPath,
  getSessionContextFromRequest,
  isAdminUser,
  isResidentUser,
} from "@/lib/access-control";

export async function GET(request: NextRequest) {
  const session = await getSessionContextFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    landingPath: computeLandingPath(session),
    systemRole: session.systemRole,
    isAdmin: isAdminUser(session),
    isResident: isResidentUser(session),
    citizenVerified: Boolean(session.citizenVerifiedAt),
  });
}

