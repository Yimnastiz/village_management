"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { useToast } from "@/components/ui/toast";
import { adminApproveGalleryItemSubmissionAction, adminRejectGalleryItemSubmissionAction } from "../actions";

export function GallerySubmissionReviewButtons({ submissionId, compact = false }: { submissionId: string; compact?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const approve = async () => { setPending("approve"); const result = await adminApproveGalleryItemSubmissionAction(submissionId); setPending(null); if (!result.success) { toast.error(result.error); return; } toast.success("อนุมัติรูปภาพเรียบร้อยแล้ว"); router.refresh(); };
  const reject = async (reason: string) => { setPending("reject"); const result = await adminRejectGalleryItemSubmissionAction(submissionId, reason); setPending(null); if (!result.success) { toast.error(result.error); return; } toast.success("บันทึกการไม่อนุมัติเรียบร้อยแล้ว"); setRejectOpen(false); router.refresh(); };
  const busy = pending !== null;
  return <><div className="flex flex-wrap gap-2"><Button size={compact ? "sm" : "md"} variant="danger" disabled={busy} onClick={() => setRejectOpen(true)}>ไม่อนุมัติ</Button><Button size={compact ? "sm" : "md"} disabled={busy} isLoading={pending === "approve"} onClick={approve}>อนุมัติ</Button></div><ActionReasonDialog open={rejectOpen} action="content.request.reject" title="ไม่อนุมัติรูปภาพ" description="เหตุผลจะถูกแจ้งแก่ผู้ส่งคำขอและบันทึกใน Audit Log" submitLabel="ยืนยันไม่อนุมัติ" loading={pending === "reject"} onCancel={() => setRejectOpen(false)} onSubmit={reject} /></>;
}
