"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { Switch } from "@/components/ui/switch";
import { updateSystemSettingsAction, type SystemSettingsInput } from "./actions";

type SettingsView = Required<SystemSettingsInput>;
type Props = { initialSettings: SettingsView };

function SwitchRow({ id, title, helper, checked, disabled, onChange }: { id: string; title: string; helper: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-4 sm:flex-row sm:items-start sm:justify-between"><div><label htmlFor={id} className="text-sm font-semibold text-slate-900">{title}</label><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{helper}</p><p className="mt-2 text-xs font-medium text-slate-500">สถานะ: {checked ? "เปิดใช้งาน" : "ปิดใช้งาน"}</p></div><Switch id={id} aria-label={title} checked={checked} disabled={disabled} onCheckedChange={onChange} /></div>;
}

export function SystemSettingsForm({ initialSettings }: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState<"maintenance" | "registration" | null>(null);
  const { success, error } = useToast();
  const save = async (next: SystemSettingsInput) => {
    setPending(true);
    try { await updateSystemSettingsAction(next); setSettings((current) => ({ ...current, ...next })); success("บันทึกการตั้งค่าระบบแล้ว"); }
    catch (cause) { error("บันทึกการตั้งค่าไม่สำเร็จ", cause instanceof Error ? cause.message : "กรุณาลองใหม่อีกครั้ง"); }
    finally { setPending(false); setConfirmation(null); }
  };
  const requestToggle = (field: "maintenanceMode" | "registrationEnabled", value: boolean) => {
    const next = { [field]: value };
    if ((field === "maintenanceMode" && value) || (field === "registrationEnabled" && !value)) { setConfirmation(field === "maintenanceMode" ? "maintenance" : "registration"); return; }
    void save(next);
  };
  return <div className="mx-auto w-full max-w-4xl space-y-6"><SuperAdminPageHeaderRegistration context={{ title: "การตั้งค่าระบบ", description: "กำหนดการเปิดให้บริการและพฤติกรรมส่วนกลางของระบบ" }} />
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="mb-5"><h2 className="text-lg font-semibold text-slate-900">สถานะระบบ</h2><p className="mt-1 text-sm text-slate-600">ควบคุมการเข้าถึงพื้นที่ปฏิบัติงานระหว่างการบำรุงรักษา</p></div><div className="space-y-4"><SwitchRow id="maintenance-mode" title="โหมดปิดปรับปรุงระบบ" helper="ปิดการใช้งานส่วนที่กำหนดของระบบชั่วคราวระหว่างการบำรุงรักษา โดยผู้ดูแลระบบระดับสูงยังสามารถเข้าจัดการระบบได้" checked={settings.maintenanceMode} disabled={pending} onChange={(value) => requestToggle("maintenanceMode", value)} /><label className="block text-sm font-semibold text-slate-900" htmlFor="maintenance-message">ข้อความขณะปิดปรับปรุง<textarea id="maintenance-message" value={settings.maintenanceMessage} maxLength={500} disabled={pending} onChange={(event) => setSettings({ ...settings, maintenanceMessage: event.target.value })} className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-50" /></label><div className="flex justify-end"><Button disabled={pending} isLoading={pending} onClick={() => void save({ maintenanceMode: settings.maintenanceMode, maintenanceMessage: settings.maintenanceMessage })}>บันทึกสถานะระบบ</Button></div></div></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="mb-5"><h2 className="text-lg font-semibold text-slate-900">การเข้าถึงระบบ</h2><p className="mt-1 text-sm text-slate-600">กำหนดบริการสาธารณะที่เปิดให้บุคคลทั่วไปใช้</p></div><div className="space-y-3"><SwitchRow id="registration-enabled" title="เปิดรับสมัครสมาชิกใหม่" helper="อนุญาตให้บุคคลทั่วไปสร้างบัญชีใหม่และดำเนินการยืนยันตัวตนตามขั้นตอนปกติ" checked={settings.registrationEnabled} disabled={pending} onChange={(value) => requestToggle("registrationEnabled", value)} /><SwitchRow id="public-feedback-enabled" title="เปิดรับความคิดเห็นจากบุคคลทั่วไป" helper="อนุญาตให้บุคคลทั่วไปส่งข้อเสนอแนะ ข้อร้องเรียน และรายงานข้อผิดพลาดเข้าสู่ระบบ" checked={settings.publicFeedbackEnabled} disabled={pending} onChange={(value) => void save({ publicFeedbackEnabled: value })} /></div></section>
    <ConfirmDialog open={confirmation === "maintenance"} title="ยืนยันการเปิดโหมดปิดปรับปรุง" description="ผู้ใช้งานทั่วไป ลูกบ้าน และผู้ดูแลหมู่บ้านจะไม่สามารถใช้พื้นที่ปฏิบัติงานหรือส่งรายการเปลี่ยนแปลงได้ จนกว่าจะปิดโหมดนี้" confirmLabel="เปิดโหมดปิดปรับปรุง" tone="danger" pending={pending} onClose={() => setConfirmation(null)} onConfirm={() => void save({ maintenanceMode: true, maintenanceMessage: settings.maintenanceMessage })} />
    <ConfirmDialog open={confirmation === "registration"} title="ยืนยันการปิดรับสมัครสมาชิกใหม่" description="ระบบจะไม่เริ่มหรือสร้างบัญชีใหม่จากขั้นตอนการสมัครจนกว่าจะเปิดรับสมัครอีกครั้ง บัญชีเดิมยังเข้าสู่ระบบได้ตามปกติ" confirmLabel="ปิดรับสมัคร" tone="danger" pending={pending} onClose={() => setConfirmation(null)} onConfirm={() => void save({ registrationEnabled: false })} />
  </div>;
}
