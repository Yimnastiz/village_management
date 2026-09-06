import { prisma } from "@/lib/prisma";

export const SYSTEM_SETTINGS_ID = "global";
export const DEFAULT_MAINTENANCE_MESSAGE = "ขณะนี้ระบบอยู่ระหว่างการปรับปรุง กรุณาลองใหม่อีกครั้งภายหลัง";

const defaults = {
  maintenanceMode: false,
  maintenanceMessage: DEFAULT_MAINTENANCE_MESSAGE,
  registrationEnabled: true,
  publicFeedbackEnabled: true,
} as const;

/** Returns the singleton and safely initializes a fresh database on first use. */
export async function getSystemSettings() {
  return prisma.systemSettings.upsert({ where: { id: SYSTEM_SETTINGS_ID }, update: {}, create: { id: SYSTEM_SETTINGS_ID, ...defaults } });
}

export async function isMaintenanceModeEnabled() {
  try { return (await getSystemSettings()).maintenanceMode; } catch { return false; }
}

export async function assertOperationalMutationAllowed() {
  if (await isMaintenanceModeEnabled()) throw new Error("ระบบอยู่ระหว่างการปรับปรุง ไม่สามารถดำเนินการได้ในขณะนี้");
}
