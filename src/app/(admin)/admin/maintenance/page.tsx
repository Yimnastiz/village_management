import { requireVillagePagePermission } from "@/lib/admin-permission.server";
import { ADMIN_SYSTEM_SETTINGS_PATH } from "@/lib/maintenance-policy";
import { getSystemSettings } from "@/lib/system-settings";
import { MaintenanceNotice } from "@/components/system/maintenance-notice";

export default async function AdminMaintenancePage() {
  await requireVillagePagePermission("village.settings.manage", { callbackUrl: "/admin/maintenance" });
  const settings = await getSystemSettings();
  return <MaintenanceNotice message={settings.maintenanceMessage} recoveryHref={ADMIN_SYSTEM_SETTINGS_PATH} />;
}
