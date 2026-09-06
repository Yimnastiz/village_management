import { prisma } from "@/lib/prisma";

export const SYSTEM_SETTINGS_ID = "global";
export const DEFAULT_MAINTENANCE_MESSAGE = "ขณะนี้ระบบอยู่ระหว่างการปรับปรุง กรุณาลองใหม่อีกครั้งภายหลัง";

export type SystemSettingsState = {
  id: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  registrationEnabled: boolean;
  publicFeedbackEnabled: boolean;
  updatedAt: Date | null;
};

const defaults: SystemSettingsState = {
  id: SYSTEM_SETTINGS_ID,
  maintenanceMode: false,
  maintenanceMessage: DEFAULT_MAINTENANCE_MESSAGE,
  registrationEnabled: true,
  publicFeedbackEnabled: true,
  updatedAt: null,
};

/** Returns the singleton and safely initializes a fresh database on first use. */
export async function getSystemSettings() {
  const settings = await prisma.systemSettings.findUnique({ where: { id: SYSTEM_SETTINGS_ID } });
  return settings ?? defaults;
}

export async function isMaintenanceModeEnabled() {
  try { return (await getSystemSettings()).maintenanceMode; } catch { return false; }
}

export async function assertOperationalMutationAllowed() {
  if (await isMaintenanceModeEnabled()) throw new Error("ระบบอยู่ระหว่างการปรับปรุง ไม่สามารถดำเนินการได้ในขณะนี้");
}
