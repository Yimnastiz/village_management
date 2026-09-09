import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_MAINTENANCE_PATH,
  ADMIN_SYSTEM_SETTINGS_API_PATH,
  ADMIN_SYSTEM_SETTINGS_PATH,
  isMaintenanceBlockedAdminPath,
  isMaintenanceBlockedMutation,
  isMaintenanceRecoveryApiPath,
  isMaintenanceRecoveryPath,
} from "../src/lib/maintenance-policy.ts";

test("only the Headman recovery pages are maintenance-safe", () => {
  assert.equal(isMaintenanceRecoveryPath(ADMIN_SYSTEM_SETTINGS_PATH), true);
  assert.equal(isMaintenanceRecoveryPath(ADMIN_MAINTENANCE_PATH), true);
  assert.equal(isMaintenanceBlockedAdminPath("/admin/news"), true);
  assert.equal(isMaintenanceBlockedAdminPath("/admin/settings/system"), false);
  assert.equal(isMaintenanceBlockedAdminPath("/admin/settings/village"), true);
});

test("only the explicit system-settings API is a maintenance recovery mutation", () => {
  assert.equal(isMaintenanceRecoveryApiPath(ADMIN_SYSTEM_SETTINGS_API_PATH), true);
  assert.equal(isMaintenanceRecoveryApiPath("/api/admin/population/export"), false);
  assert.equal(isMaintenanceBlockedMutation("/admin/news"), true);
  assert.equal(isMaintenanceBlockedMutation("/resident/issues"), true);
  assert.equal(isMaintenanceBlockedMutation(ADMIN_SYSTEM_SETTINGS_PATH), false);
  assert.equal(isMaintenanceBlockedMutation("/api/auth/login-otp/verify"), false);
});
