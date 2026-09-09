import { requireVillagePagePermission } from "@/lib/admin-permission.server";
import { getSystemSettings } from "@/lib/system-settings";
import { SystemSettingsClient } from "./system-settings-client";

export default async function AdminSystemSettingsPage() {
  await requireVillagePagePermission("village.settings.manage", { callbackUrl: "/admin/settings/system" });
  const settings = await getSystemSettings();
  return <SystemSettingsClient initialSettings={{ maintenanceMode: settings.maintenanceMode, maintenanceMessage: settings.maintenanceMessage, registrationEnabled: settings.registrationEnabled, publicFeedbackEnabled: settings.publicFeedbackEnabled }} />;
}
