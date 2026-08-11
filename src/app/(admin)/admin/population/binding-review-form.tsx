"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

type Result = { success: boolean; message?: string };
type Action = (previousState: Result, formData: FormData) => Promise<Result>;
type House = { id: string; houseNumber: string };

export function BindingReviewForm({ requestId, applicantName = "ผู้ขอ", houseId, houseNumber, houses, reviewAction, verifyAction, houseMismatch = false, nationalIdClaimed = false }: { requestId: string; applicantName?: string; houseId: string | null; houseNumber: string | null; houses: House[]; reviewAction: Action; verifyAction: Action; houseMismatch?: boolean; nationalIdClaimed?: boolean; villageId?: string; personHouseNumber?: string | null; personNationalId?: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [confirmPersonHouseChange, setConfirmPersonHouseChange] = useState(false);
  const ready = Boolean(houseId) && !nationalIdClaimed;
  const run = (action: Action, formData: FormData, successMessage: string, close?: () => void) => startTransition(async () => {
    const result = await action({ success: false }, formData);
    if (!result.success) { toast.error("ไม่สามารถดำเนินการได้", result.message); return; }
    toast.success(successMessage, result.message);
    close?.(); router.refresh();
  });
  const verifyHouse = (form: HTMLFormElement) => {
    setVerifyError(""); const data = new FormData(form);
    startTransition(async () => { const result = await verifyAction({ success: false }, data); if (!result.success) { setVerifyError(result.message ?? "ไม่สามารถตรวจสอบบ้านได้"); toast.error("ไม่สามารถสร้างหรือจับคู่บ้านได้", result.message); return; } toast.success("สร้างหรือจับคู่บ้านเรียบร้อยแล้ว"); router.refresh(); });
  };
  return <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
    <div><h2 className="font-semibold text-gray-900">การพิจารณาคำขอ</h2><p className="mt-1 text-sm text-gray-500">ตรวจสอบข้อมูลให้ครบถ้วนก่อนอนุมัติหรือปฏิเสธ</p></div>
    {!houseId ? <form className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3" onSubmit={(event) => { event.preventDefault(); verifyHouse(event.currentTarget); }}>
      <input type="hidden" name="requestId" value={requestId} />
      <div><p className="font-medium text-amber-950">ไม่พบเลขบ้าน {houseNumber ?? "-"} ในทะเบียนบ้าน</p><p className="mt-1 text-sm text-amber-800">สร้างบ้านจากคำขอนี้ หรือเลือกบ้านที่มีอยู่ก่อนอนุมัติ</p></div>
      <label className="block text-sm font-medium text-gray-700">บ้านที่มีอยู่ (เลือกเมื่อเป็นบ้านเดียวกัน)<select name="selectedHouseId" defaultValue="" className="mt-1 min-h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"><option value="">สร้างบ้านเลขที่ {houseNumber ?? "ใหม่"} จากคำขอนี้</option>{houses.map((house) => <option key={house.id} value={house.id}>บ้านเลขที่ {house.houseNumber}</option>)}</select></label>
      <label className="block text-sm font-medium text-gray-700">บันทึกการตรวจสอบ <span className="text-rose-600">*</span><textarea name="sourceNote" required minLength={5} rows={2} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="ระบุแหล่งที่มาหรือเหตุผลที่ตรวจสอบ" /></label>
      {verifyError ? <p className="text-sm text-rose-700">{verifyError}</p> : null}
      <Button type="submit" isLoading={pending} className="w-full sm:w-auto">สร้าง / จับคู่บ้าน</Button>
    </form> : <div className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-900">บ้านเลขที่ <strong>{houseNumber}</strong> พร้อมสำหรับการพิจารณา</div>}
    {nationalIdClaimed ? <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">เลขบัตรประชาชนนี้ถูกใช้กับบัญชีที่ผูกบ้านแล้ว จึงไม่สามารถอนุมัติคำขอนี้ได้</p> : null}
    {houseMismatch ? <label className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><input type="checkbox" checked={confirmPersonHouseChange} onChange={(event) => setConfirmPersonHouseChange(event.target.checked)} className="mt-0.5 size-4" />ยืนยันการย้ายข้อมูลบุคคลไปยังบ้านตามคำขอนี้</label> : null}
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => setRejectOpen(true)} disabled={pending}>ปฏิเสธ</Button><Button type="button" onClick={() => setApproveOpen(true)} disabled={!ready || pending || (houseMismatch && !confirmPersonHouseChange)}>อนุมัติ</Button></div>
    <ConfirmDialog open={approveOpen} title="ยืนยันการผูกบ้าน" description={`บัญชี: ${applicantName}\nบ้านเลขที่: ${houseNumber ?? "-"}\n\nหลังอนุมัติ ผู้ใช้จะได้รับสิทธิ์ลูกบ้านของหมู่บ้านนี้`} confirmLabel="ยืนยันอนุมัติ" pending={pending} onClose={() => setApproveOpen(false)} onConfirm={() => { const data = new FormData(); data.set("requestId", requestId); data.set("action", "approve"); data.set("reviewNote", reviewNote); if (confirmPersonHouseChange) data.set("confirmPersonHouseChange", "true"); run(reviewAction, data, "อนุมัติคำขอเรียบร้อยแล้ว", () => setApproveOpen(false)); }} />
    {approveOpen ? <label className="sr-only">หมายเหตุ (ไม่บังคับ)<input value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} /></label> : null}
    {rejectOpen ? <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="reject-title"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><h2 id="reject-title" className="text-lg font-semibold text-slate-900">ปฏิเสธคำขอผูกเลขบ้าน</h2><label className="mt-4 block text-sm font-medium text-slate-700">กรุณาระบุเหตุผล <span className="text-rose-600">*</span><textarea autoFocus required rows={4} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => setRejectOpen(false)} disabled={pending}>ยกเลิก</Button><Button type="button" variant="danger" disabled={!rejectReason.trim() || pending} isLoading={pending} onClick={() => { const data = new FormData(); data.set("requestId", requestId); data.set("action", "reject"); data.set("reviewNote", rejectReason.trim()); run(reviewAction, data, "ปฏิเสธคำขอเรียบร้อยแล้ว", () => setRejectOpen(false)); }}>ยืนยันการปฏิเสธ</Button></div></div></div> : null}
  </section>;
}
