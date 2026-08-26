"use client";

import Link from "next/link";
import { Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { createResidentEventChangeRequestAction, deleteResidentVillageEventSubmissionAction } from "../actions";

export function ResidentRequestActions({ requestId, status, type }: { requestId: string; status: string; type: string }) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteRequestOpen, setDeleteRequestOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [changeRequested, setChangeRequested] = useState(false);
  const router = useRouter();
  const { pushToast } = useToast();

  const requestDelete = async () => {
    const detail = reason.trim();
    if (!detail) { setError("กรุณาระบุเหตุผลที่ต้องการลบ"); return; }
    setPending(true); setError("");
    const result = await createResidentEventChangeRequestAction(requestId, "DELETE", detail);
    setPending(false);
    if (!result.success) { setError(result.error); return; }
    setDeleteRequestOpen(false); setChangeRequested(true);
    pushToast({ tone: "success", title: "ส่งคำขอลบให้ผู้ใหญ่บ้านพิจารณาแล้ว" });
  };

  const removePending = async () => {
    setPending(true);
    const result = await deleteResidentVillageEventSubmissionAction(requestId);
    setPending(false);
    if (!result.success) { pushToast({ tone: "error", title: "ลบคำขอไม่สำเร็จ", description: result.error }); return; }
    pushToast({ tone: "success", title: "ลบคำขอเรียบร้อยแล้ว" });
    router.push("/resident/calendar/requests");
  };

  if ((status !== "PENDING" && status !== "APPROVED") || (status === "APPROVED" && type !== "CREATE")) return null;

  return <div className="space-y-3 border-t border-gray-100 pt-4">
    {status === "APPROVED" ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">กิจกรรมนี้เผยแพร่แล้ว การแก้ไขหรือลบจะมีผลหลังผู้ใหญ่บ้านอนุมัติเท่านั้น</p> : null}
    {changeRequested ? <p className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-sm font-medium text-amber-900">รอผู้ใหญ่บ้านอนุมัติคำขอลบ</p> : <div className="flex flex-col gap-2 sm:flex-row">
      {type === "CREATE" ? <Link href={`/resident/calendar/requests/${requestId}/edit`} className="w-full sm:w-auto"><Button variant="outline" className="w-full"><Pencil className="mr-1.5 h-4 w-4" />{status === "APPROVED" ? "ขอแก้ไขกิจกรรม" : "แก้ไข"}</Button></Link> : null}
      <Button variant="danger" className="w-full sm:w-auto" onClick={() => status === "PENDING" ? setConfirmDeleteOpen(true) : setDeleteRequestOpen(true)}><Trash2 className="mr-1.5 h-4 w-4" />{status === "PENDING" ? "ลบคำขอ" : "ขอลบกิจกรรม"}</Button>
    </div>}
    <ConfirmDialog open={confirmDeleteOpen} onClose={() => !pending && setConfirmDeleteOpen(false)} onConfirm={removePending} pending={pending} tone="danger" title="ลบคำขอนี้?" description="คำขอที่ยังรอพิจารณาจะถูกลบ โดยไม่กระทบกิจกรรมที่เผยแพร่แล้ว" confirmLabel="ลบคำขอ" />
    {deleteRequestOpen ? <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-request-title">
      <div className="my-auto w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><div><h2 id="delete-request-title" className="text-lg font-semibold text-slate-900">ส่งคำขอลบกิจกรรม</h2><p className="mt-1 text-sm text-slate-600">กิจกรรมเดิมจะยังแสดงอยู่จนกว่าผู้ใหญ่บ้านจะอนุมัติ</p></div><button type="button" aria-label="ปิด" disabled={pending} onClick={() => setDeleteRequestOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
        <div className="mt-4"><Textarea label="เหตุผลที่ต้องการลบ" value={reason} onChange={(event) => { setReason(event.target.value); setError(""); }} rows={4} error={error || undefined} /></div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={pending} onClick={() => setDeleteRequestOpen(false)} className="w-full sm:w-auto">ยกเลิก</Button><Button type="button" variant="danger" isLoading={pending} onClick={requestDelete} className="w-full sm:w-auto">ส่งคำขอลบ</Button></div>
      </div>
    </div> : null}
  </div>;
}
