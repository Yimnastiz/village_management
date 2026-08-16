"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { updateVillageSettingsAction } from "../actions";

type Village = { name: string; slug: string; moo: string | null; province: string | null; district: string | null; subdistrict: string | null; description: string | null; address: string | null; phone: string | null; email: string | null; website: string | null };

const value = (input: string | null) => input?.trim() || "-";

function IdentityRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid min-w-0 gap-1 border-b border-slate-100 py-3 last:border-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4"><dt className="text-sm text-slate-500">{label}</dt><dd className="min-w-0 break-words text-sm font-medium text-slate-900">{children}</dd></div>;
}

export function VillageSettingsForm({ village }: { village: Village }) {
  const { success, error } = useToast();
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await updateVillageSettingsAction(new FormData(event.currentTarget));
      if (result.success) success("บันทึก settings หมู่บ้านสำเร็จ");
      else error("บันทึก settings หมู่บ้านไม่สำเร็จ", result.error);
    } catch {
      error("บันทึก settings หมู่บ้านไม่สำเร็จ");
    } finally { setPending(false); }
  }

  return <form onSubmit={submit} className="space-y-5">
    <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
      <h2 className="text-base font-semibold text-slate-900">ข้อมูลระบุตัวตนหมู่บ้าน</h2>
      <p className="mt-1 text-sm text-slate-500">ข้อมูลชื่อหมู่บ้านและพื้นที่ถูกกำหนดโดย Super Admin หากต้องการแก้ไข กรุณาติดต่อผู้ดูแลระบบสูงสุด</p>
      <dl className="mt-3"><IdentityRow label="ชื่อหมู่บ้าน">{value(village.name)}</IdentityRow><IdentityRow label="หมู่ที่">{value(village.moo)}</IdentityRow><IdentityRow label="Slug"><span className="break-all">{village.slug}</span></IdentityRow><IdentityRow label="พื้นที่">{`ต.${value(village.subdistrict)} อ.${value(village.district)} จ.${value(village.province)}`}</IdentityRow></dl>
    </section>
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-semibold text-gray-900">ข้อมูลติดต่อสาธารณะ</h2>
      <p className="mt-1 text-sm text-gray-500">ข้อมูลส่วนนี้จะแสดงบนหน้าเว็บไซต์สาธารณะของหมู่บ้าน ตั้งเฉพาะช่องทางที่ต้องการเผยแพร่</p>
      <div className="mt-5 space-y-4"><label className="block space-y-1"><span className="text-sm text-gray-700">คำอธิบาย</span><textarea name="description" defaultValue={village.description ?? ""} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label><label className="block space-y-1"><span className="text-sm text-gray-700">ที่อยู่เพิ่มเติม</span><textarea name="address" defaultValue={village.address ?? ""} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label className="space-y-1"><span className="text-sm text-gray-700">เบอร์โทร</span><input name="phone" defaultValue={village.phone ?? ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label><label className="space-y-1"><span className="text-sm text-gray-700">อีเมล</span><input name="email" type="email" defaultValue={village.email ?? ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label><label className="space-y-1"><span className="text-sm text-gray-700">เว็บไซต์</span><input name="website" defaultValue={village.website ?? ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label></div></div>
      <div className="mt-5 flex justify-end"><Button type="submit" isLoading={pending} className="min-h-10"><Save className="mr-2 h-4 w-4" />บันทึกการตั้งค่า</Button></div>
    </section>
  </form>;
}
