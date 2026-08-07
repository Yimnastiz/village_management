import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedAccessRedirectPath,
  getDuplicateNoticeSessionFromRequest,
  getSessionContextFromRequest,
  isAdminUser,
  isResidentUser,
} from "@/lib/access-control";

export async function GET(request: NextRequest) {
  const session = await getSessionContextFromRequest(request);

  if (!session) {
    const duplicateSession = await getDuplicateNoticeSessionFromRequest(request);
    if (duplicateSession) {
      return NextResponse.json({
        landingPath: "/auth/account-duplicate",
        systemRole: null,
        isAdmin: false,
        isResident: false,
        citizenVerified: false,
      });
    }
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
