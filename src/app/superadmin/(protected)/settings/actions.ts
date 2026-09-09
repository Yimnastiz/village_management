"use server";

import { AuditAction, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminActionSession } from "@/lib/superadmin";
import { type SystemSettingsInput, updateSystemSettings } from "@/lib/system-settings-update";

export type { SystemSettingsInput } from "@/lib/system-settings-update";

/** Transitional Super Admin compatibility wrapper around the shared settings service. */
export async function updateSystemSettingsAction(input: SystemSettingsInput) {
  const session = await requireSuperAdminActionSession();
  await prisma.$transaction(async (tx) => {
    const { settings, oldValue, newValue } = await updateSystemSettings(tx, input);
    await tx.auditLog.create({ data: {
      userId: session.id, action: AuditAction.UPDATE, resource: "SystemSettings", resourceId: settings.id,
      metadata: { actorType: "SUPERADMIN_ENV", actorRole: "SUPERADMIN", actionName: "SYSTEM_SETTINGS_UPDATED", oldValue, newValue } as Prisma.InputJsonValue,
    } });
  });
  revalidateSystemSettingsPages();
}

export function revalidateSystemSettingsPages() {
  revalidatePath("/superadmin/settings");
  revalidatePath("/admin/settings/system");
  revalidatePath("/admin/maintenance");
  revalidatePath("/auth/register");
  revalidatePath("/feedback");
}
