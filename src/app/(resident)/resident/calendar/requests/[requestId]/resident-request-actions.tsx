"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { createResidentEventChangeRequestAction, deleteResidentVillageEventSubmissionAction } from "../actions";

export function ResidentRequestActions({ requestId, status }: { requestId: string; status: string }) {
  const [open, setOpen] = useState(false); const [pending, setPending] = useState(false);
  const [changeRequested, setChangeRequested] = useState(false);
  const router = useRouter(); const { pushToast } = useToast();
  const requestChange = async (action: "EDIT" | "DELETE") => { const reason = window.prompt(action === "EDIT" ? "รายละเอียดที่ต้องการแก้ไข" : "เหตุผลที่ต้องการลบ"); if (!reason?.trim()) return; setPending(true); const result = await createResidentEventChangeRequestAction(requestId, action, reason); setPending(false); if (!result.success) { pushToast({ tone: "error", title: "ส่งคำขอไม่สำเร็จ", description: result.error }); return; } setChangeRequested(true); pushToast({ tone: "success", title: "ส่งคำขอให้ผู้ใหญ่บ้านพิจารณาแล้ว" }); };
  if (status !== "PENDING") return status === "APPROVED" ? <div className="space-y-2 border-t border-gray-100 pt-4"><p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">กิจกรรมนี้เผยแพร่แล้ว การเปลี่ยนแปลงต้องรอผู้ใหญ่บ้านอนุมัติ</p>{changeRequested ? <p className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-sm font-medium text-amber-900">รอผู้ใหญ่บ้านอนุมัติ</p> : <div className="flex flex-col gap-2 sm:flex-row"><Button variant="outline" disabled={pending} onClick={() => requestChange("EDIT")} className="w-full sm:w-auto">ขอแก้ไข</Button><Button variant="danger" disabled={pending} onClick={() => requestChange("DELETE")} className="w-full sm:w-auto">ขอลบ</Button></div>}</div> : null;
  const remove = async () => { setPending(true); const result = await deleteResidentVillageEventSubmissionAction(requestId); setPending(false); if (!result.success) { pushToast({ tone: "error", title: "ลบคำขอไม่สำเร็จ", description: result.error }); return; } pushToast({ tone: "success", title: "ลบคำขอเรียบร้อยแล้ว" }); router.push("/resident/calendar/requests"); };
  return <div className="flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row"><Link href={`/resident/calendar/requests/${requestId}/edit`} className="w-full sm:w-auto"><Button variant="outline" className="w-full"><Pencil className="mr-1.5 h-4 w-4" />แก้ไข</Button></Link><Button variant="danger" className="w-full sm:w-auto" onClick={() => setOpen(true)}><Trash2 className="mr-1.5 h-4 w-4" />ลบคำขอ</Button><ConfirmDialog open={open} onClose={() => !pending && setOpen(false)} onConfirm={remove} pending={pending} tone="danger" title="ลบคำขอนี้?" description="คำขอที่ยังรอพิจารณาจะถูกลบ และไม่กระทบกิจกรรมที่เผยแพร่แล้ว" confirmLabel="ลบคำขอ" /></div>;
}
