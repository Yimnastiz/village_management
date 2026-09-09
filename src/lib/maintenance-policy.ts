/** The only Headman recovery surfaces available while maintenance is enabled. */
export const ADMIN_SYSTEM_SETTINGS_PATH = "/admin/settings/system";
export const ADMIN_MAINTENANCE_PATH = "/admin/maintenance";
export const ADMIN_SYSTEM_SETTINGS_API_PATH = "/api/admin/system-settings";

export function isMaintenanceRecoveryPath(pathname: string): boolean {
  return pathname === ADMIN_SYSTEM_SETTINGS_PATH || pathname === ADMIN_MAINTENANCE_PATH;
}

export function isMaintenanceRecoveryApiPath(pathname: string): boolean {
  return pathname === ADMIN_SYSTEM_SETTINGS_API_PATH;
}

export function isMaintenanceBlockedAdminPath(pathname: string): boolean {
  return pathname.startsWith("/admin") && !isMaintenanceRecoveryPath(pathname);
}

export function isMaintenanceBlockedMutation(pathname: string): boolean {
  return pathname.startsWith("/resident") || pathname.startsWith("/admin");
}
