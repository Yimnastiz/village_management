"use client";

import { SystemSettingsForm as SharedSystemSettingsForm } from "@/components/settings/system-settings-form";
import { updateSystemSettingsAction, type SystemSettingsInput } from "./actions";

type SettingsView = Required<SystemSettingsInput>;
export function SystemSettingsForm({ initialSettings }: { initialSettings: SettingsView }) {
  return <SharedSystemSettingsForm initialSettings={initialSettings} onSave={updateSystemSettingsAction} />;
}
