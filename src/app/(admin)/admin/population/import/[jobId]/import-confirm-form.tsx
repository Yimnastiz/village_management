"use client";

import { useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { confirmPopulationImportAction, deleteImportJobDatasetAction } from "./actions";

type ImportJobActionsProps = { jobId: string; createdRows: number; updatedRows: number; conflictRows: number; failedRows: number; cleanupPeopleCount: number; cleanupHousesCount: number; canConfirm: boolean; canCleanup: boolean };

function ReasonField({ label, value, onChange, error, helper }: { label: string; value: string; onChange: (value: string) => void; error?: string; helper: string }) {
  return <label className="block text-sm font-medium text-gray-800">{label} <span className="text-red-600">*</span><textarea value={value} onChange={(event) => onChange(event.target.value)} required minLength={5} maxLength={500} rows={4} className={`mt-1.5 block w-full rounded-lg border px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 ${error ? "border-red-400 focus:ring-red-200" : "border-gray-300 focus:border-green-600 focus:ring-green-100"}`} /><span className={error ? "mt-1 block text-xs text-red-600" : "mt-1 block text-xs font-normal text-gray-500"}>{error ?? helper}</span></label>;
}

export function ImportJobActions({ jobId, createdRows, updatedRows, conflictRows, failedRows, cleanupPeopleCount, cleanupHousesCount, canConfirm, canCleanup }: ImportJobActionsProps) {
  const router = useRouter(); const toast = useToast();
  const [dialog, setDialog] = useState<"confirm" | "cleanup" | null>(null);
  const [confirmReason, setConfirmReason] = useState(""); const [cleanupReason, setCleanupReason] = useState(""); const [fieldError, setFieldError] = useState("");
  const [isPending, startTransition] = useTransition();
  const close = () => { if (!isPending) { setDialog(null); setFieldError(""); } };
  const submitConfirm = () => {
    const reason = confirmReason.trim(); if (reason.length < 5) { setFieldError("กรุณาระบุหมายเหตุการยืนยันอย่างน้อย 5 ตัวอักษร"); return; }
    startTransition(async () => { try { const formData = new FormData(); formData.set("jobId", jobId); formData.set("supportReason", reason); await confirmPopulationImportAction(formData); setDialog(null); setFieldError(""); toast.success("นำเข้าข้อมูลสำเร็จ"); router.refresh(); } catch (error) { toast.error("นำเข้าข้อมูลไม่สำเร็จ", error instanceof Error ? error.message : "กรุณาลองใหม่อีกครั้ง"); } });
  };
  const submitCleanup = () => {
    const reason = cleanupReason.trim(); if (reason.length < 5) { setFieldError("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร"); return; }
    startTransition(async () => { try { const formData = new FormData(); formData.set("jobId", jobId); formData.set("supportReason", reason); await deleteImportJobDatasetAction(formData); setDialog(null); setFieldError(""); toast.success("ลบข้อมูลที่สร้างจากงานนำเข้าเรียบร้อยแล้ว"); router.refresh(); } catch (error) { toast.error("ไม่สามารถลบข้อมูลที่สร้างจากงานนำเข้าได้", error instanceof Error ? error.message : "กรุณาลองใหม่อีกครั้ง"); } });
  };
  return <>
    {canConfirm ? <Button type="button" onClick={() => { setFieldError(""); setDialog("confirm"); }}>ยืนยันนำเข้าข้อมูล</Button> : null}
    {canCleanup ? <Button type="button" variant="danger" onClick={() => { setFieldError(""); setDialog("cleanup"); }}><Trash2 className="mr-1.5 h-4 w-4" />ลบข้อมูลที่สร้างจากงานนี้</Button> : null}
    <Dialog open={dialog === "confirm"} onClose={close} closeOnBackdrop={false} closeOnEscape={false} title="ยืนยันนำเข้าข้อมูล" description="ระบบจะบันทึกรายการตามผลตรวจสอบและบันทึกการดำเนินการใน Audit Log" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={isPending} onClick={close}>ยกเลิก</Button><Button type="button" isLoading={isPending} disabled={confirmReason.trim().length < 5} onClick={submitConfirm}>ยืนยันนำเข้าข้อมูล</Button></div>}>
      <ul className="space-y-2 text-sm text-gray-700"><li>สร้างใหม่ {createdRows.toLocaleString("th-TH")} รายการ</li><li>อัปเดตข้อมูล {updatedRows.toLocaleString("th-TH")} รายการ</li><li>ต้องตรวจสอบ {conflictRows.toLocaleString("th-TH")} รายการ</li>{failedRows > 0 ? <li>ไม่สามารถนำเข้า {failedRows.toLocaleString("th-TH")} รายการ</li> : null}</ul>
      {conflictRows > 0 || failedRows > 0 ? <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm leading-5 text-gray-600">รายการที่ต้องตรวจสอบหรือไม่สามารถนำเข้าจะไม่ถูกบันทึกในการยืนยันครั้งนี้</p> : null}
      <div className="mt-4"><ReasonField label="หมายเหตุการยืนยัน" value={confirmReason} onChange={(value) => { setConfirmReason(value); setFieldError(""); }} error={fieldError || undefined} helper="บันทึกเหตุผลประกอบการยืนยัน อย่างน้อย 5 ตัวอักษร" /></div>
    </Dialog>
    <Dialog open={dialog === "cleanup"} onClose={close} closeOnBackdrop={false} closeOnEscape={false} title="ลบข้อมูลที่สร้างจากงานนำเข้านี้" description="การดำเนินการนี้อาจกระทบข้อมูลประชากร และไม่สามารถย้อนกลับได้" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={isPending} onClick={close}>ยกเลิก</Button><Button type="button" variant="danger" isLoading={isPending} disabled={cleanupReason.trim().length < 5} onClick={submitCleanup}>ยืนยันลบข้อมูล</Button></div>}>
      <div className="flex gap-3 rounded-lg bg-red-50 p-3 text-sm leading-5 text-red-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><p>ระบบจะลบเฉพาะข้อมูลที่ติดตามได้ว่า “สร้างใหม่” จากงานนี้เท่านั้น ข้อมูลเดิมที่ถูกอัปเดตจะไม่ถูกกู้คืนเป็นค่าเดิมโดยอัตโนมัติ</p></div>
      <ul className="mt-4 space-y-2 text-sm text-gray-700"><li>บุคคลที่ติดตามได้: {cleanupPeopleCount.toLocaleString("th-TH")} รายการ</li><li>บ้านที่ติดตามได้: {cleanupHousesCount.toLocaleString("th-TH")} หลัง</li></ul>
      <div className="mt-4"><ReasonField label="เหตุผล" value={cleanupReason} onChange={(value) => { setCleanupReason(value); setFieldError(""); }} error={fieldError || undefined} helper="อย่างน้อย 5 ตัวอักษร" /></div>
    </Dialog>
  </>;
}

function LegacySubmit({ onClick }: { onClick: () => void }) {
  const { pending } = useFormStatus();
  return <button type="button" onClick={onClick} disabled={pending} className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{pending ? "กำลังยืนยัน..." : "ยืนยันนำเข้าข้อมูล"}</button>;
}

// The superadmin workspace keeps its existing compact confirm form; the Admin
// job page uses ImportJobActions above for the full review workflow.
export function ImportConfirmForm({ jobId, targetVillageId, confirmAction = confirmPopulationImportAction }: { jobId: string; targetVillageId?: string; confirmAction?: typeof confirmPopulationImportAction }) {
  const ref = useRef<HTMLFormElement>(null); const [open, setOpen] = useState(false); const toast = useToast();
  return <form ref={ref} action={async (formData) => { try { await confirmAction(formData); toast.success("นำเข้าข้อมูลสำเร็จ"); } catch (error) { toast.error("นำเข้าข้อมูลไม่สำเร็จ", error instanceof Error ? error.message : "กรุณาลองใหม่อีกครั้ง"); } }} className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
    <input type="hidden" name="jobId" value={jobId} />{targetVillageId ? <input type="hidden" name="targetVillageId" value={targetVillageId} /> : null}
    <label className="flex-1 text-sm font-medium text-amber-950">เหตุผลการยืนยัน<input required minLength={5} name="supportReason" className="mt-1 block w-full rounded-lg border border-amber-300 bg-white px-3 py-2" placeholder="เช่น ตรวจสอบกับทะเบียนบ้านแล้ว" /></label>
    <LegacySubmit onClick={() => { if (ref.current?.reportValidity()) setOpen(true); }} />
    <ConfirmDialog open={open} title="ยืนยันนำเข้าข้อมูล" description="ข้อมูลตาม Preview จะถูกเพิ่มหรือแก้ไขในหมู่บ้านเป้าหมาย และบันทึกใน Audit Log" confirmLabel="ยืนยันนำเข้า" onClose={() => setOpen(false)} onConfirm={() => { ref.current?.requestSubmit(); setOpen(false); }} />
  </form>;
}
