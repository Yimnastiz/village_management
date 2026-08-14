"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { adminApproveVillagePlaceSubmissionAction, adminRejectVillagePlaceSubmissionAction } from "../actions";

const reasonValidationMessage = "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร";

export function PlaceRequestReviewButtons({ requestId, placeName, type }: { requestId: string; placeName: string; type: "CREATE" | "UPDATE" }) {
  const router = useRouter(); const toast = useToast(); const [dialog, setDialog] = useState<"approve" | "reject" | null>(null); const [pending, setPending] = useState(false); const [reason, setReason] = useState(""); const [reasonError, setReasonError] = useState("");
  const approve = async () => { setPending(true); try { const result = await adminApproveVillagePlaceSubmissionAction(requestId); if (!result.success) { toast.error(result.error); return; } setDialog(null); toast.success("อนุมัติคำขอเรียบร้อยแล้ว"); router.replace(`/admin/places/${result.placeId}`); } catch { toast.error("ไม่สามารถอนุมัติคำขอได้ กรุณาลองใหม่อีกครั้ง"); } finally { setPending(false); } };
  const reject = async () => { if (reason.trim().length < 5) { setReasonError(reasonValidationMessage); return; } setPending(true); try { const result = await adminRejectVillagePlaceSubmissionAction(requestId, reason); if (!result.success) { if (result.error === reasonValidationMessage) setReasonError(result.error); else toast.error(result.error); return; } setDialog(null); toast.success("บันทึกการไม่อนุมัติเรียบร้อยแล้ว"); router.refresh(); } catch { toast.error("ไม่สามารถบันทึกการไม่อนุมัติได้ กรุณาลองใหม่อีกครั้ง"); } finally { setPending(false); } };
  const actionLabel = type === "UPDATE" ? "แก้ไขสถานที่" : "เพิ่มสถานที่";
  return <div className="flex flex-col gap-2 sm:flex-row"><Button onClick={() => setDialog("approve")}>อนุมัติ</Button><Button variant="danger" onClick={() => setDialog("reject")}>ไม่อนุมัติ</Button><ConfirmDialog open={dialog === "approve"} onClose={() => !pending && setDialog(null)} onConfirm={approve} pending={pending} title={`อนุมัติคำขอ${actionLabel} “${placeName}”?`} confirmLabel="อนุมัติ" /><ConfirmDialog open={dialog === "reject"} onClose={() => !pending && setDialog(null)} onConfirm={reject} pending={pending} tone="danger" title="ไม่อนุมัติคำขอนี้" confirmLabel="ยืนยันไม่อนุมัติ" confirmDisabled={reason.trim().length < 5}><Textarea label="เหตุผล *" value={reason} onChange={(event) => { setReason(event.target.value); setReasonError(""); }} error={reasonError} helperText="กรุณาระบุอย่างน้อย 5 ตัวอักษร" className="min-h-28 text-base" /></ConfirmDialog></div>;
}
