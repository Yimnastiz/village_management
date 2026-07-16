import { AuditAction, Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  getSessionContextFromServerCookies,
  getSessionContextFromRequest,
  isSuperAdminUser,
  type SessionContext,
} from "@/lib/access-control";

export async function requireSuperAdminPageSession(): Promise<SessionContext> {
  const session = await getSessionContextFromServerCookies();
  if (!session) {
    redirect("/auth/login?callbackUrl=/superadmin/dashboard");
  }

  if (!isSuperAdminUser(session)) {
    redirect("/resident/dashboard");
  }

  return session;
}

export async function requireSuperAdminActionSession(): Promise<SessionContext> {
  const session = await getSessionContextFromServerCookies();
  if (!session || !isSuperAdminUser(session)) {
    throw new Error("Unauthorized");
  }

  return session;
}

export async function requireSuperAdminRequestSession(request: Request): Promise<SessionContext | null> {
  const session = await getSessionContextFromRequest(request);
  if (!session || !isSuperAdminUser(session)) {
    return null;
  }

  return session;
}

export async function writeSuperAdminAuditLog(input: {
  userId: string;
  action: AuditAction;
  resource: string;
  resourceId?: string | null;
  metadata?: Prisma.InputJsonValue;
  villageId?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId ?? null,
      villageId: input.villageId ?? null,
      metadata: input.metadata,
    },
  });
}
