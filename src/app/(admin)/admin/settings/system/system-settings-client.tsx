"use client";

import { SystemSettingsForm } from "@/components/settings/system-settings-form";
import { ADMIN_SYSTEM_SETTINGS_API_PATH } from "@/lib/maintenance-policy";
import type { SystemSettingsInput } from "@/lib/system-settings-update";

type SettingsView = Required<SystemSettingsInput>;
export function SystemSettingsClient({ initialSettings }: { initialSettings: SettingsView }) {
  return <SystemSettingsForm initialSettings={initialSettings} onSave={async (input) => {
    const response = await fetch(ADMIN_SYSTEM_SETTINGS_API_PATH, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) throw new Error(body?.error ?? "บันทึกการตั้งค่าไม่สำเร็จ");
  }} />;
}
