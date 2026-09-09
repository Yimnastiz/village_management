import { AuditAction, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getVillagePermissionContext } from "@/lib/admin-permission.server";
import { prisma } from "@/lib/prisma";
import { updateSystemSettings } from "@/lib/system-settings-update";

/** The sole non-operational Headman mutation allowed during maintenance. */
export async function POST(request: Request) {
  const context = await getVillagePermissionContext("village.settings.manage");
  if (!context) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const input = await request.json().catch(() => null);
  if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 });
  try {
    await prisma.$transaction(async (tx) => {
      const { settings, changedKeys, oldValue, newValue } = await updateSystemSettings(tx, input);
      await tx.auditLog.create({ data: {
        userId: context.session.id, villageId: context.villageId, action: AuditAction.UPDATE, resource: "SystemSettings", resourceId: settings.id,
        metadata: { actorRole: "HEADMAN", actionName: "SYSTEM_SETTINGS_UPDATED", changedKeys, oldValue, newValue } as Prisma.InputJsonValue,
      } });
    });
    ["/admin/settings/system", "/admin/maintenance", "/auth/register", "/feedback"].forEach((path) => revalidatePath(path));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update system settings" }, { status: 400 });
  }
}

export const runtime = "nodejs";
