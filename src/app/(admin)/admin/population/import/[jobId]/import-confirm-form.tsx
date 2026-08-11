"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { confirmPopulationImportAction } from "./actions";

function Submit({ onClick }: { onClick: () => void }) {
  const { pending } = useFormStatus();
  return <button type="button" onClick={onClick} disabled={pending} className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{pending ? "กำลังยืนยัน..." : "ยืนยันนำเข้าข้อมูล"}</button>;
}

export function ImportConfirmForm({ jobId, targetVillageId, confirmAction = confirmPopulationImportAction }: { jobId: string; targetVillageId?: string; confirmAction?: typeof confirmPopulationImportAction }) {
  const ref = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return <form
    ref={ref}
    action={async (formData) => {
      try {
        await confirmAction(formData);
        toast.success("นำเข้าข้อมูลสำเร็จ");
      } catch (error) {
        toast.error("นำเข้าข้อมูลไม่สำเร็จ", error instanceof Error ? error.message : "กรุณาลองใหม่อีกครั้ง");
      }
    }}
    className="mt-4 flex flex-col gap-3 md:flex-row md:items-end"
  >
    <input type="hidden" name="jobId" value={jobId} />
    {targetVillageId ? <input type="hidden" name="targetVillageId" value={targetVillageId} /> : null}
    <label className="flex-1 text-sm font-medium text-amber-950">เหตุผลการยืนยัน
      <input required minLength={5} name="supportReason" className="mt-1 block w-full rounded-lg border border-amber-300 bg-white px-3 py-2" placeholder="เช่น ตรวจสอบกับทะเบียนบ้านแล้ว" />
    </label>
    <Submit onClick={() => { if (ref.current?.reportValidity()) setOpen(true); }} />
    <ConfirmDialog open={open} title="ยืนยันนำเข้าข้อมูล" description="ข้อมูลตาม Preview จะถูกเพิ่มหรือแก้ไขในหมู่บ้านเป้าหมาย และบันทึกใน Audit Log" confirmLabel="ยืนยันนำเข้า" onClose={() => setOpen(false)} onConfirm={() => { ref.current?.requestSubmit(); setOpen(false); }} />
  </form>;
}
