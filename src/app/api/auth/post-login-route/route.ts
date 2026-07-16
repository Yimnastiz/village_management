import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedAccessRedirectPath,
  getSessionContextFromRequest,
  isAdminUser,
  isResidentUser,
} from "@/lib/access-control";

export async function GET(request: NextRequest) {
  const session = await getSessionContextFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landingPath = await getAuthenticatedAccessRedirectPath(session);
  if (process.env.NODE_ENV === "development") console.log("[auth] post-login route", { landingPath });

  return NextResponse.json({
    landingPath,
    systemRole: session.systemRole,
    isAdmin: isAdminUser(session),
    isResident: isResidentUser(session),
    citizenVerified: Boolean(session.citizenVerifiedAt),
  });
}
