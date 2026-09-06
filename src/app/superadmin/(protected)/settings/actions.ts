"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminActionSession } from "@/lib/superadmin";
import { SYSTEM_SETTINGS_ID } from "@/lib/system-settings";

const settingsSchema = z.object({
  maintenanceMode: z.boolean(),
  maintenanceMessage: z.string().trim().max(500),
  registrationEnabled: z.boolean(),
  publicFeedbackEnabled: z.boolean(),
}).superRefine((value, context) => {
  if (value.maintenanceMode && !value.maintenanceMessage) {
    context.addIssue({ code: "custom", path: ["maintenanceMessage"], message: "กรุณาระบุข้อความขณะปิดปรับปรุง" });
  }
});

export type SystemSettingsInput = z.infer<typeof settingsSchema>;

export async function updateSystemSettingsAction(input: SystemSettingsInput) {
  const session = await requireSuperAdminActionSession();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "ข้อมูลการตั้งค่าไม่ถูกต้อง");

  const value = parsed.data;
  const old = await prisma.systemSettings.findUnique({ where: { id: SYSTEM_SETTINGS_ID } });
  await prisma.$transaction(async (tx) => {
    const settings = await tx.systemSettings.upsert({
      where: { id: SYSTEM_SETTINGS_ID },
      update: { ...value, updatedById: session.id },
      create: { id: SYSTEM_SETTINGS_ID, ...value, updatedById: session.id },
    });
    await tx.auditLog.create({ data: {
      userId: session.id, action: AuditAction.UPDATE, resource: "SystemSettings", resourceId: settings.id,
      metadata: { actorType: "SUPERADMIN_ENV", actionName: "SYSTEM_SETTINGS_UPDATED", oldValue: old ? { maintenanceMode: old.maintenanceMode, maintenanceMessage: old.maintenanceMessage, registrationEnabled: old.registrationEnabled, publicFeedbackEnabled: old.publicFeedbackEnabled } : null, newValue: value },
    } });
  });

  revalidatePath("/superadmin/settings");
  revalidatePath("/auth/register");
  revalidatePath("/feedback");
}
