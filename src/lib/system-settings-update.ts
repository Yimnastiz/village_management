import { Prisma } from "@prisma/client";
import { z } from "zod";
import { DEFAULT_MAINTENANCE_MESSAGE, SYSTEM_SETTINGS_ID } from "@/lib/system-settings";

export const settingsUpdateSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().trim().max(500).optional(),
  registrationEnabled: z.boolean().optional(),
  publicFeedbackEnabled: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "ไม่มีข้อมูลการตั้งค่าที่ต้องบันทึก");

export type SystemSettingsInput = z.infer<typeof settingsUpdateSchema>;
const settingKeys = ["maintenanceMode", "maintenanceMessage", "registrationEnabled", "publicFeedbackEnabled"] as const;

export async function updateSystemSettings(tx: Prisma.TransactionClient, input: unknown) {
  const parsed = settingsUpdateSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "ข้อมูลการตั้งค่าไม่ถูกต้อง");
  const update = parsed.data;
  const existing = await tx.systemSettings.findUnique({ where: { id: SYSTEM_SETTINGS_ID } });
  const nextMaintenanceMode = update.maintenanceMode ?? existing?.maintenanceMode ?? false;
  const nextMaintenanceMessage = update.maintenanceMessage ?? existing?.maintenanceMessage ?? DEFAULT_MAINTENANCE_MESSAGE;
  if (nextMaintenanceMode && !nextMaintenanceMessage.trim()) throw new Error("กรุณาระบุข้อความขณะปิดปรับปรุง");
  const changedKeys = settingKeys.filter((key) => key in update);
  const fallbackValue = (key: typeof settingKeys[number]) => key === "maintenanceMode" ? false : key === "maintenanceMessage" ? DEFAULT_MAINTENANCE_MESSAGE : true;
  const oldValue = Object.fromEntries(changedKeys.map((key) => [key, existing?.[key] ?? fallbackValue(key)]));
  const settings = await tx.systemSettings.upsert({
    where: { id: SYSTEM_SETTINGS_ID }, update,
    create: { id: SYSTEM_SETTINGS_ID, maintenanceMode: update.maintenanceMode ?? false, maintenanceMessage: update.maintenanceMessage ?? DEFAULT_MAINTENANCE_MESSAGE, registrationEnabled: update.registrationEnabled ?? true, publicFeedbackEnabled: update.publicFeedbackEnabled ?? true },
  });
  const newValue = Object.fromEntries(changedKeys.map((key) => [key, settings[key]]));
  return { settings, changedKeys, oldValue, newValue };
}
