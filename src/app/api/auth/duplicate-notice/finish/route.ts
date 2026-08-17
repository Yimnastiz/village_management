import { AccountStatus, AuditAction } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getDuplicateAccountRoutingStateFromRequest } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { expireSessionCookies } from "@/lib/session-cookie";

/**
 * Completes the one-time duplicate notice in one response. The browser cookie
 * and database sessions are invalidated together, so a stale cookie cannot
 * route the user back to this page after the notice has been seen.
 */
export async function POST(request: NextRequest) {
  const state = await getDuplicateAccountRoutingStateFromRequest(request);
  const userId = state.kind === "DUPLICATE_NOTICE_PENDING" || state.kind === "DUPLICATE_NOTICE_SEEN"
    ? state.id
    : null;

  if (!userId) {
    const response = NextResponse.json(
      { error: "Duplicate-account notice session not found." },
      { status: 409 }
    );
    expireSessionCookies(response);
    return response;
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const marked = await tx.user.updateMany({
      where: {
        id: userId,
        accountStatus: AccountStatus.DUPLICATE_ID,
        duplicateNoticeSeenAt: null,
      },
      data: { duplicateNoticeSeenAt: now },
    });
    if (marked.count) {
      await tx.auditLog.create({
        data: {
          userId,
          action: AuditAction.VIEW_SENSITIVE,
          resource: "DuplicateNationalIdNotice",
          resourceId: userId,
          metadata: { event: "DUPLICATE_NATIONAL_ID_NOTICE_SEEN" },
        },
      });
    }
    await tx.authSession.deleteMany({ where: { userId } });
  });

  const response = NextResponse.json({ ok: true });
  expireSessionCookies(response);
  return response;
}
