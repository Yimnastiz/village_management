"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { useToast } from "@/components/ui/toast";
import { CONTACT_CATEGORY_OPTIONS, normalizeContactPhone, validateContactEmail, validateContactPhone } from "@/lib/contact";
import { superAdminSaveContactDataAction } from "../public-content-actions";

type Contact = { id?: string; name: string; role: string | null; phone: string | null; email: string | null; address: string | null; category: string | null; sortOrder: number; isPublic: boolean };

export function SuperAdminContactForm({ villageId, initial }: { villageId: string; initial?: Contact }) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<Record<string, string | boolean> | null>(null);
  const [pending, setPending] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const phone = normalizeContactPhone(String(form.get("phone") ?? ""));
    const email = String(form.get("email") ?? "").trim();
    const error = validateContactPhone(phone, false) ?? validateContactEmail(email);
    if (error) { toast.error(error); return; }
    setDraft({ name: String(form.get("name") ?? "").trim(), role: String(form.get("role") ?? "").trim(), phone, email, address: String(form.get("address") ?? "").trim(), category: String(form.get("category") ?? ""), sortOrder: String(form.get("sortOrder") ?? "0"), isPublic: form.get("isPublic") === "on" });
  };
  const confirm = async (reason: string) => {
    if (!draft) return;
    setPending(true);
    const result = await superAdminSaveContactDataAction(villageId, initial?.id ?? null, draft, reason);
    setPending(false);
    if (!result.success) { toast.error(result.error); return; }
    setDraft(null); router.replace(`/superadmin/villages/${villageId}/contacts`);
  };
  return <>
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-white p-4 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Input name="name" label="ชื่อ" defaultValue={initial?.name ?? ""} required /><Input name="role" label="ตำแหน่ง/บทบาท" defaultValue={initial?.role ?? ""} /><Select name="category" label="หมวดหมู่" defaultValue={initial?.category ?? ""} options={CONTACT_CATEGORY_OPTIONS} required /><Input name="phone" label="เบอร์โทรศัพท์" defaultValue={initial?.phone ?? ""} /><Input name="email" label="อีเมล" type="email" defaultValue={initial?.email ?? ""} /><Input name="sortOrder" label="ลำดับ" inputMode="numeric" defaultValue={String(initial?.sortOrder ?? 0)} /></div>
      <Textarea name="address" label="ที่อยู่" rows={2} defaultValue={initial?.address ?? ""} /><label className="flex items-center gap-2 text-sm"><input name="isPublic" type="checkbox" defaultChecked={initial?.isPublic ?? true} /> แสดงผลสาธารณะ</label>
      <Button type="submit">{initial ? "บันทึกการแก้ไข" : "สร้างผู้ติดต่อ"}</Button>
    </form>
    <ActionReasonDialog open={Boolean(draft)} action="content.archive" title={initial ? "ยืนยันการแก้ไขผู้ติดต่อ" : "ยืนยันการสร้างผู้ติดต่อ"} description="ระบบจะบันทึก Audit Log และแจ้งผู้ดูแลหมู่บ้าน" reasonLabel="เหตุผลในการดำเนินการ" helperText="ระบุเหตุผลที่ผู้ดูแลระบบระดับสูงดำเนินการแทนผู้ดูแลหมู่บ้าน" requireReason minReasonLength={5} maxReasonLength={500} loading={pending} onCancel={() => setDraft(null)} onSubmit={confirm} />
  </>;
}
