"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { ContactRequestType } from "@prisma/client";
import { approveResidentContactRequestAction, rejectResidentContactRequestAction } from "./actions";

export function ContactRequestDecisionActions({ requestId, contactName, requestType }: { requestId: string; contactName: string; requestType: ContactRequestType }) {
  const router = useRouter(); const toast = useToast();
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null); const [reason, setReason] = useState(""); const [reasonError, setReasonError] = useState(""); const [pending, setPending] = useState(false);
  async function approve() { setPending(true); const form = new FormData(); form.set("requestId", requestId); const result = await approveResidentContactRequestAction(form); setPending(false); setDialog(null); result.success ? (result.already ? toast.info(result.message) : toast.success(result.message)) : toast.error(result.message); router.refresh(); }
  async function reject() { if (reason.trim().length < 5) { setReasonError("กรุณาระบุอย่างน้อย 5 ตัวอักษร"); return; } setPending(true); const form = new FormData(); form.set("requestId", requestId); form.set("reason", reason.trim()); const result = await rejectResidentContactRequestAction(form); setPending(false); setDialog(null); result.success ? (result.already ? toast.info(result.message) : toast.success(result.message)) : toast.error(result.message); router.refresh(); }
  const isUpdate = requestType === "UPDATE";
  const isDelete = requestType === "DELETE";
  return <><div className="mt-6 flex flex-col-reverse gap-2 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end"><Button variant="danger" type="button" onClick={() => setDialog("reject")}>ไม่อนุมัติ</Button><Button type="button" onClick={() => setDialog("approve")}>อนุมัติ</Button></div>
    <ConfirmDialog open={dialog === "approve"} title={isDelete ? "อนุมัติคำขอลบผู้ติดต่อ?" : isUpdate ? "อนุมัติคำขอแก้ไขผู้ติดต่อ?" : "อนุมัติคำขอเพิ่มผู้ติดต่อ?"} description={isDelete ? `ระบบจะนำ “${contactName}” ออกจากรายชื่อผู้ติดต่อ และล้างเฉพาะรายการบันทึกผู้ติดต่อที่เกี่ยวข้อง` : isUpdate ? `ระบบจะปรับข้อมูลของ “${contactName}” ตามข้อมูลที่เสนอ` : `ระบบจะเพิ่ม “${contactName}” เข้ารายชื่อผู้ติดต่อของหมู่บ้าน\n\nการมองเห็นเริ่มต้น: เฉพาะลูกบ้าน`} confirmLabel="ยืนยันอนุมัติ" tone={isDelete ? "danger" : "default"} pending={pending} onClose={() => setDialog(null)} onConfirm={approve} />
    <ConfirmDialog open={dialog === "reject"} title="ไม่อนุมัติคำขอ" confirmLabel="ยืนยันไม่อนุมัติ" tone="danger" pending={pending} confirmDisabled={reason.trim().length < 5} onClose={() => { setDialog(null); setReasonError(""); }} onConfirm={reject}><Textarea autoFocus label="เหตุผล" required minLength={5} value={reason} onChange={(event) => { setReason(event.target.value); if (reasonError) setReasonError(""); }} error={reasonError} helperText="อย่างน้อย 5 ตัวอักษร" className="min-h-28 text-base" /></ConfirmDialog>
  </>;
}
