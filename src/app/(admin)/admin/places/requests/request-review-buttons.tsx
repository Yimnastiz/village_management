"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { useToast } from "@/components/ui/toast";
import { adminApproveVillagePlaceSubmissionAction, adminRejectVillagePlaceSubmissionAction } from "../actions";

export function PlaceRequestReviewButtons({ requestId, placeName, type }: { requestId: string; placeName: string; type: "CREATE" | "UPDATE" }) {
  const router = useRouter(); const toast = useToast(); const [dialog, setDialog] = useState<"approve" | "reject" | null>(null); const [pending, setPending] = useState(false);
  const approve = async () => { setPending(true); try { const result = await adminApproveVillagePlaceSubmissionAction(requestId); if (!result.success) { toast.error(result.error); return; } setDialog(null); toast.success("อนุมัติคำขอเรียบร้อยแล้ว"); router.replace(`/admin/places/${result.placeId}`); } catch { toast.error("ไม่สามารถอนุมัติคำขอได้ กรุณาลองใหม่อีกครั้ง"); } finally { setPending(false); } };
  const reject = async (reason: string) => { setPending(true); try { const result = await adminRejectVillagePlaceSubmissionAction(requestId, reason); if (!result.success) { toast.error(result.error); return; } setDialog(null); toast.success("บันทึกการไม่อนุมัติเรียบร้อยแล้ว"); router.refresh(); } catch { toast.error("ไม่สามารถบันทึกการไม่อนุมัติได้ กรุณาลองใหม่อีกครั้ง"); } finally { setPending(false); } };
  const actionLabel = type === "UPDATE" ? "แก้ไขสถานที่" : "เพิ่มสถานที่";
  return <div className="flex flex-col gap-2 sm:flex-row"><Button onClick={() => setDialog("approve")}>อนุมัติ</Button><Button variant="danger" onClick={() => setDialog("reject")}>ไม่อนุมัติ</Button><ConfirmDialog open={dialog === "approve"} onClose={() => !pending && setDialog(null)} onConfirm={approve} pending={pending} title={`อนุมัติคำขอ${actionLabel} “${placeName}”?`} confirmLabel="อนุมัติ" /><ActionReasonDialog open={dialog === "reject"} action="content.request.reject" title="ไม่อนุมัติคำขอนี้" description="เหตุผลจะถูกแจ้งแก่ผู้ส่งคำขอและบันทึกใน Audit Log" submitLabel="ยืนยันไม่อนุมัติ" loading={pending} onCancel={() => setDialog(null)} onSubmit={reject} /></div>;
}
