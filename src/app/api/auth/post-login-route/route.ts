import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedAccessRedirectPath,
  getSessionContextFromRequest,
  isAdminUser,
  isResidentUser,
} from "@/lib/access-control";
import { inspectPendingResidentAccessFromRequest } from "@/lib/pending-resident-access";

export async function GET(request: NextRequest) {
  const session = await getSessionContextFromRequest(request);

  if (!session) {
    const pending = await inspectPendingResidentAccessFromRequest(request);
    if (pending.kind === "PENDING") {
      return NextResponse.json({ landingPath: "/resident/dashboard", isAdmin: false, isResident: false });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landingPath = await getAuthenticatedAccessRedirectPath(session);
  if (process.env.NODE_ENV === "development") console.log("[auth] post-login route", { landingPath });

  return NextResponse.json({
    landingPath,
    isAdmin: isAdminUser(session),
    isResident: isResidentUser(session),
  });
}
