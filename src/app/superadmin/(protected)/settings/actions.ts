"use server";

import { AuditAction, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminActionSession } from "@/lib/superadmin";
import { DEFAULT_MAINTENANCE_MESSAGE, SYSTEM_SETTINGS_ID } from "@/lib/system-settings";

const settingsUpdateSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().trim().max(500).optional(),
  registrationEnabled: z.boolean().optional(),
  publicFeedbackEnabled: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "ไม่มีข้อมูลการตั้งค่าที่ต้องบันทึก");

export type SystemSettingsInput = z.infer<typeof settingsUpdateSchema>;

const settingKeys = ["maintenanceMode", "maintenanceMessage", "registrationEnabled", "publicFeedbackEnabled"] as const;

export async function updateSystemSettingsAction(input: SystemSettingsInput) {
  const session = await requireSuperAdminActionSession();
  const parsed = settingsUpdateSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "ข้อมูลการตั้งค่าไม่ถูกต้อง");

  const update = parsed.data;
  await prisma.$transaction(async (tx) => {
    const existing = await tx.systemSettings.findUnique({ where: { id: SYSTEM_SETTINGS_ID } });
    const nextMaintenanceMode = update.maintenanceMode ?? existing?.maintenanceMode ?? false;
    const nextMaintenanceMessage = update.maintenanceMessage ?? existing?.maintenanceMessage ?? DEFAULT_MAINTENANCE_MESSAGE;
    if (nextMaintenanceMode && !nextMaintenanceMessage.trim()) throw new Error("กรุณาระบุข้อความขณะปิดปรับปรุง");

    const changedKeys = settingKeys.filter((key) => key in update);
    const oldValue = Object.fromEntries(changedKeys.map((key) => [key, existing?.[key] ?? (key === "maintenanceMode" ? false : key === "maintenanceMessage" ? DEFAULT_MAINTENANCE_MESSAGE : true)]));
    const settings = await tx.systemSettings.upsert({
      where: { id: SYSTEM_SETTINGS_ID },
      update,
      create: { id: SYSTEM_SETTINGS_ID, maintenanceMode: update.maintenanceMode ?? false, maintenanceMessage: update.maintenanceMessage ?? DEFAULT_MAINTENANCE_MESSAGE, registrationEnabled: update.registrationEnabled ?? true, publicFeedbackEnabled: update.publicFeedbackEnabled ?? true },
    });
    const newValue = Object.fromEntries(changedKeys.map((key) => [key, settings[key]]));
    await tx.auditLog.create({ data: {
      userId: session.id, action: AuditAction.UPDATE, resource: "SystemSettings", resourceId: settings.id,
      metadata: { actorType: "SUPERADMIN_ENV", actorRole: "SUPERADMIN", actionName: "SYSTEM_SETTINGS_UPDATED", oldValue, newValue } as Prisma.InputJsonValue,
    } });
  });

  revalidatePath("/superadmin/settings");
  revalidatePath("/auth/register");
  revalidatePath("/feedback");
}
