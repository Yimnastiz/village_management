"use client";

import { useState } from "react";
import { Edit3, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { updateVillageSettingsAction } from "../actions";

type Village = { name: string; slug: string; moo: string | null; province: string | null; district: string | null; subdistrict: string | null; description: string | null; address: string | null; phone: string | null; email: string | null; website: string | null };
const shown = (input: string | null) => input?.trim() || "-";
function Row({ label, value }: { label: string; value: string | null }) { return <div className="grid gap-1 border-b border-gray-100 py-3 last:border-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4"><dt className="text-sm text-gray-500">{label}</dt><dd className="min-w-0 break-words text-sm font-medium text-gray-900">{shown(value)}</dd></div>; }

export function VillageSettingsForm({ village }: { village: Village }) {
  const router = useRouter(); const toast = useToast(); const [editing, setEditing] = useState(false); const [pending, setPending] = useState(false); const [formError, setFormError] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); setFormError(null); try { const result = await updateVillageSettingsAction(new FormData(event.currentTarget)); if (!result.success) { setFormError(result.error); toast.error("บันทึกข้อมูลหมู่บ้านไม่สำเร็จ", result.error); return; } toast.success("บันทึกข้อมูลหมู่บ้านเรียบร้อยแล้ว"); setEditing(false); router.refresh(); } catch { setFormError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"); toast.error("บันทึกข้อมูลหมู่บ้านไม่สำเร็จ"); } finally { setPending(false); } }
  return <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
    <header className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-gray-900">ข้อมูลหมู่บ้าน</h2><p className="mt-1 text-sm text-gray-500">ข้อมูลระบุตัวตนและช่องทางติดต่อสาธารณะ</p></div>{!editing ? <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}><Edit3 className="mr-2 h-4 w-4" />แก้ไข</Button> : null}</header>
    <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50/70 px-4"><dl><Row label="ชื่อหมู่บ้าน" value={village.name} /><Row label="หมู่ที่" value={village.moo} /><Row label="พื้นที่" value={[village.subdistrict && `ต.${village.subdistrict}`, village.district && `อ.${village.district}`, village.province && `จ.${village.province}`].filter(Boolean).join(" ")} /><Row label="Slug" value={village.slug} /></dl><p className="border-t border-gray-200 py-3 text-xs text-gray-500">ข้อมูลอัตลักษณ์และพื้นที่กำหนดโดย Super Admin เพื่อป้องกันการอ้างอิงหมู่บ้านผิดพื้นที่</p></div>
    {!editing ? <dl className="mt-4"><Row label="คำอธิบาย" value={village.description} /><Row label="ที่อยู่เพิ่มเติม" value={village.address} /><Row label="โทรศัพท์" value={village.phone} /><Row label="อีเมล" value={village.email} /><Row label="เว็บไซต์" value={village.website} /></dl> :
      <form onSubmit={submit} className="mt-5 space-y-4 border-t border-gray-100 pt-5"><Textarea label="คำอธิบาย" name="description" defaultValue={village.description ?? ""} rows={3} /><Textarea label="ที่อยู่เพิ่มเติม" name="address" defaultValue={village.address ?? ""} rows={2} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Input label="โทรศัพท์" name="phone" defaultValue={village.phone ?? ""} /><Input label="อีเมล" name="email" type="email" defaultValue={village.email ?? ""} /><Input label="เว็บไซต์" name="website" type="url" defaultValue={village.website ?? ""} placeholder="https://" /></div>{formError ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p> : null}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={pending} onClick={() => { setFormError(null); setEditing(false); }}><X className="mr-2 h-4 w-4" />ยกเลิก</Button><Button type="submit" isLoading={pending}><Save className="mr-2 h-4 w-4" />บันทึกการแก้ไข</Button></div></form>}
  </section>;
}
