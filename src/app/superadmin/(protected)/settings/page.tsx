import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { getSystemSettings } from "@/lib/system-settings";
import { SystemSettingsForm } from "./system-settings-form";

export default async function SuperAdminSettingsPage() {
  await requireSuperAdminPageSession();
  const settings = await getSystemSettings();
  return <SystemSettingsForm initialSettings={{ maintenanceMode: settings.maintenanceMode, maintenanceMessage: settings.maintenanceMessage, registrationEnabled: settings.registrationEnabled, publicFeedbackEnabled: settings.publicFeedbackEnabled }} />;
}
