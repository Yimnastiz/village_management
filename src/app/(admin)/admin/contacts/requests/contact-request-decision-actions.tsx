"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { useToast } from "@/components/ui/toast";
import type { ContactRequestType } from "@prisma/client";
import { approveResidentContactRequestAction, rejectResidentContactRequestAction } from "./actions";

export function ContactRequestDecisionActions({ requestId, contactName, requestType }: { requestId: string; contactName: string; requestType: ContactRequestType }) {
  const router = useRouter(); const toast = useToast();
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null); const [pending, setPending] = useState(false);
  async function approve(reason = "") { setPending(true); const form = new FormData(); form.set("requestId", requestId); if (reason) form.set("reason", reason); const result = await approveResidentContactRequestAction(form); setPending(false); if (result.success) { setDialog(null); result.already ? toast.info(result.message) : toast.success(result.message); router.refresh(); } else toast.error(result.message); }
  async function reject(reason: string) { setPending(true); const form = new FormData(); form.set("requestId", requestId); form.set("reason", reason); const result = await rejectResidentContactRequestAction(form); setPending(false); if (result.success) { setDialog(null); result.already ? toast.info(result.message) : toast.success(result.message); router.refresh(); } else toast.error(result.message); }
  const isUpdate = requestType === "UPDATE";
  const isDelete = requestType === "DELETE";
  return <><div className="mt-6 flex flex-col-reverse gap-2 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end"><Button variant="danger" type="button" onClick={() => setDialog("reject")}>ไม่อนุมัติ</Button><Button type="button" onClick={() => setDialog("approve")}>อนุมัติ</Button></div>
    <ConfirmDialog open={dialog === "approve" && !isDelete} title={isUpdate ? "อนุมัติคำขอแก้ไขผู้ติดต่อ?" : "อนุมัติคำขอเพิ่มผู้ติดต่อ?"} description={isUpdate ? `ระบบจะปรับข้อมูลของ “${contactName}” ตามข้อมูลที่เสนอ` : `ระบบจะเพิ่ม “${contactName}” เข้ารายชื่อผู้ติดต่อของหมู่บ้าน\n\nการมองเห็นเริ่มต้น: เฉพาะลูกบ้าน`} confirmLabel="ยืนยันอนุมัติ" pending={pending} onClose={() => setDialog(null)} onConfirm={() => { void approve(); }} />
    <ActionReasonDialog open={dialog === "approve" && isDelete} action="content.delete" title="อนุมัติคำขอลบผู้ติดต่อ" description={`ระบบจะนำ “${contactName}” ออกจากรายชื่อ และบันทึกเหตุผลใน Audit Log`} submitLabel="ยืนยันอนุมัติและลบ" loading={pending} onCancel={() => setDialog(null)} onSubmit={approve} />
    <ActionReasonDialog open={dialog === "reject"} action="content.request.reject" title="ไม่อนุมัติคำขอ" description="เหตุผลจะถูกแจ้งแก่ผู้ส่งคำขอและบันทึกใน Audit Log" submitLabel="ยืนยันไม่อนุมัติ" loading={pending} onCancel={() => setDialog(null)} onSubmit={reject} />
  </>;
}
