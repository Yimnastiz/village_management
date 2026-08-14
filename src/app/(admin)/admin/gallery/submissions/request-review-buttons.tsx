"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { adminApproveGalleryItemSubmissionAction, adminRejectGalleryItemSubmissionAction } from "../actions";

export function GallerySubmissionReviewButtons({ submissionId, compact = false }: { submissionId: string; compact?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const approve = async () => { setPending("approve"); const result = await adminApproveGalleryItemSubmissionAction(submissionId); setPending(null); if (!result.success) { toast.error(result.error); return; } toast.success("อนุมัติรูปภาพเรียบร้อยแล้ว"); router.refresh(); };
  const reject = async () => { setPending("reject"); const result = await adminRejectGalleryItemSubmissionAction(submissionId, reason); setPending(null); if (!result.success) { toast.error(result.error); return; } toast.success("บันทึกการไม่อนุมัติเรียบร้อยแล้ว"); setRejectOpen(false); setReason(""); router.refresh(); };
  const busy = pending !== null;
  return <><div className="flex flex-wrap gap-2"><Button size={compact ? "sm" : "md"} variant="danger" disabled={busy} onClick={() => setRejectOpen(true)}>ไม่อนุมัติ</Button><Button size={compact ? "sm" : "md"} disabled={busy} isLoading={pending === "approve"} onClick={approve}>อนุมัติ</Button></div><ConfirmDialog open={rejectOpen} title="ไม่อนุมัติรูปภาพ" confirmLabel="ยืนยันไม่อนุมัติ" tone="danger" pending={pending === "reject"} confirmDisabled={reason.trim().length < 5} onClose={() => { if (!busy) { setRejectOpen(false); setReason(""); } }} onConfirm={reject}><label className="block text-sm font-medium text-gray-700">เหตุผลที่ไม่อนุมัติ <span className="text-red-600">*</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={5} maxLength={500} required className="mt-1 min-h-24 w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500" /></label></ConfirmDialog></>;
}
