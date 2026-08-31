"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { useToast } from "@/components/ui/toast";
import { superAdminDeleteTransparencyDataAction, superAdminSaveTransparencyDataAction } from "../public-content-actions";

type RecordInput = { id: string; title: string; description: string | null; category: string | null; amount: number | null; fiscalYear: string | null; stage: "DRAFT" | "PUBLISHED" | "ARCHIVED"; visibility: "PUBLIC" | "RESIDENT_ONLY" };
type Draft = { title: string; description: string; category: string; amount: string; fiscalYear: string; stage: "DRAFT" | "PUBLISHED" | "ARCHIVED"; visibility: "PUBLIC" | "RESIDENT_ONLY" };

const stageOptions = [{ value: "DRAFT", label: "ฉบับร่าง" }, { value: "PUBLISHED", label: "เผยแพร่" }, { value: "ARCHIVED", label: "เก็บถาวร" }];
const visibilityOptions = [{ value: "PUBLIC", label: "สาธารณะ" }, { value: "RESIDENT_ONLY", label: "เฉพาะลูกบ้าน" }];

export function SuperAdminTransparencyForm({ villageId, initial }: { villageId: string; initial?: RecordInput | null }) {
  const router = useRouter();
  const toast = useToast();
  const submitting = useRef(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);

  const begin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    const form = new FormData(event.currentTarget);
    setDraft({
      title: String(form.get("title") ?? ""), description: String(form.get("description") ?? ""), category: String(form.get("category") ?? ""),
      amount: String(form.get("amount") ?? ""), fiscalYear: String(form.get("fiscalYear") ?? ""), stage: String(form.get("stage") ?? "DRAFT") as Draft["stage"], visibility: String(form.get("visibility") ?? "PUBLIC") as Draft["visibility"],
    });
  };
  const save = async (reason: string) => {
    if (!draft || submitting.current) return;
    submitting.current = true; setPending(true);
    try {
      const result = await superAdminSaveTransparencyDataAction(villageId, initial?.id ?? null, draft, reason);
      if (!result.success) { toast.error(result.error); return; }
      toast.success(initial ? "บันทึกการแก้ไขแล้ว" : "สร้างรายการแล้ว");
      setDraft(null); router.replace(`/superadmin/villages/${villageId}/transparency`);
    } finally { submitting.current = false; setPending(false); }
  };
  return <><form onSubmit={begin} className="space-y-3 rounded-xl border bg-white p-4 sm:p-6"><h2 className="font-semibold text-slate-900">{initial ? "แก้ไขรายการ" : "สร้างรายการ"}</h2><div className="grid gap-3 md:grid-cols-3"><Input name="title" label="ชื่อรายการ" defaultValue={initial?.title ?? ""} required /><Input name="category" label="ประเภท" defaultValue={initial?.category ?? ""} /><Input name="fiscalYear" label="ปี/ช่วงเวลา" defaultValue={initial?.fiscalYear ?? ""} /><Input name="amount" label="จำนวนเงิน" defaultValue={initial?.amount?.toString() ?? ""} inputMode="decimal" /><Select name="stage" label="สถานะ" defaultValue={initial?.stage ?? "DRAFT"} options={stageOptions} /><Select name="visibility" label="การมองเห็น" defaultValue={initial?.visibility ?? "PUBLIC"} options={visibilityOptions} /></div><Textarea name="description" label="รายละเอียด" rows={4} defaultValue={initial?.description ?? ""} /><div className="flex flex-col-reverse gap-2 sm:flex-row"><Button type="button" variant="outline" onClick={() => router.replace(`/superadmin/villages/${villageId}/transparency`)}>ยกเลิก</Button><Button type="submit" disabled={pending} isLoading={pending}>{initial ? "บันทึกการแก้ไข" : "สร้างรายการ"}</Button></div></form><ActionReasonDialog open={Boolean(draft)} action="content.archive" title={initial ? "ยืนยันการแก้ไขรายการความโปร่งใส" : "ยืนยันการสร้างรายการความโปร่งใส"} description="การดำเนินการนี้จะถูกบันทึกใน Audit Log และแจ้งผู้ดูแลหมู่บ้าน" reasonLabel="เหตุผลในการดำเนินการ" helperText="ระบุเหตุผลที่ผู้ดูแลระบบระดับสูงดำเนินการแทนผู้ดูแลหมู่บ้าน" requireReason minReasonLength={5} maxReasonLength={500} loading={pending} onCancel={() => setDraft(null)} onSubmit={save} /></>;
}

export function SuperAdminDeleteTransparencyButton({ villageId, recordId, title }: { villageId: string; recordId: string; title: string }) {
  const router = useRouter(); const toast = useToast(); const [open, setOpen] = useState(false); const [pending, setPending] = useState(false);
  const remove = async (reason: string) => { setPending(true); try { const result = await superAdminDeleteTransparencyDataAction(villageId, recordId, reason); if (!result.success) { toast.error(result.error); return; } toast.success("ลบรายการแล้ว"); setOpen(false); router.refresh(); } finally { setPending(false); } };
  return <><Button type="button" variant="danger" onClick={() => setOpen(true)} disabled={pending}>ลบ</Button><ActionReasonDialog open={open} action="content.delete" title="ยืนยันการลบรายการความโปร่งใส" description={`รายการ “${title}” จะถูกลบออก`} reasonLabel="เหตุผลในการดำเนินการ" helperText="ระบุเหตุผลที่ผู้ดูแลระบบระดับสูงดำเนินการแทนผู้ดูแลหมู่บ้าน" requireReason minReasonLength={5} maxReasonLength={500} loading={pending} onCancel={() => setOpen(false)} onSubmit={remove} /></>;
}
