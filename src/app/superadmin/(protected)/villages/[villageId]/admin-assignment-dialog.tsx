"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { setVillageAdminSupportAction } from "./actions";

export function AdminAssignmentDialog({ villageId, users }: { villageId: string; users: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const router = useRouter(); const toast = useToast();
  const submit = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); setBusy(true); try { const result = await setVillageAdminSupportAction(villageId, new FormData(event.currentTarget)); toast.success(result.message); setOpen(false); router.refresh(); } catch (error) { toast.error("แต่งตั้งผู้ดูแลไม่สำเร็จ", error instanceof Error ? error.message : "เกิดข้อผิดพลาด"); } finally { setBusy(false); } };
  return <><Button type="button" onClick={() => setOpen(true)}>แต่งตั้งผู้ดูแล</Button><Dialog open={open} title="แต่งตั้งผู้ดูแล" description="กำหนดบทบาทให้ผู้ใช้ในหมู่บ้านนี้" onClose={() => !busy && setOpen(false)} closeOnBackdrop={false} closeOnEscape={!busy} footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>ยกเลิก</Button><Button type="submit" form="admin-assignment-form" isLoading={busy} disabled={busy}>ยืนยันการแต่งตั้ง</Button></div>}>
    <form id="admin-assignment-form" onSubmit={submit} className="grid gap-4"><label className="grid gap-1.5 text-sm font-medium text-slate-700">ผู้ใช้<select name="userId" required className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 font-normal"><option value="">เลือกผู้ใช้ในหมู่บ้านนี้</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label className="grid gap-1.5 text-sm font-medium text-slate-700">บทบาท<select name="role" className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 font-normal"><option value="HEADMAN">ผู้ใหญ่บ้าน</option><option value="ASSISTANT_HEADMAN">ผู้ช่วยผู้ใหญ่บ้าน</option></select></label><label className="grid gap-1.5 text-sm font-medium text-slate-700">เหตุผลสนับสนุน <span className="text-xs font-normal text-slate-500">อธิบายเหตุผลอย่างน้อย 5 ตัวอักษร <span className="text-red-600">*</span></span><textarea name="reason" required minLength={5} rows={3} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label><p className="text-xs text-slate-500">การยืนยันนี้จะบันทึกการแต่งตั้งและแจ้งผู้ดูแลหมู่บ้านตามกฎการจัดการบทบาท</p></form>
  </Dialog></>;
}
