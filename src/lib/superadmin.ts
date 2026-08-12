import { AuditAction, Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSuperAdminSession, readSuperAdminSessionFromServerCookies, type SuperAdminSession } from "@/lib/superadmin-auth";

export async function requireSuperAdminPageSession(): Promise<SuperAdminSession> {
  const session = await readSuperAdminSessionFromServerCookies();
  if (!session) {
    redirect("/superadmin/access");
  }

  return session;
}

export async function requireSuperAdminActionSession(): Promise<SuperAdminSession> {
  const session = await readSuperAdminSessionFromServerCookies();
  if (!session) {
    throw new Error("Unauthorized");
  }

  return session;
}

export async function requireSuperAdminRequestSession(request: Request): Promise<SuperAdminSession | null> {
  return readSuperAdminSession(request.headers.get("cookie")?.match(/(?:^|; )village_superadmin_session=([^;]*)/)?.[1]);
}

export async function writeSuperAdminAuditLog(input: {
  userId?: string | null;
  action: AuditAction;
  resource: string;
  resourceId?: string | null;
  metadata?: Prisma.InputJsonValue;
  villageId?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId ?? null,
      villageId: input.villageId ?? null,
      metadata: { ...(input.metadata && typeof input.metadata === "object" ? input.metadata : {}), actorType: "SUPERADMIN_ENV" },
    },
  });
}
