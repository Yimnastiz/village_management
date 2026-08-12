"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { reviewCorrectionAction, type CorrectionActionState } from "./correction-actions";

export function CorrectionReviewForm({ villageId, requestId, reviewAction = reviewCorrectionAction }: { villageId: string; requestId: string; reviewAction?: typeof reviewCorrectionAction }) {
  const [state, action, pending] = useActionState(reviewAction, { success: false } as CorrectionActionState);
  const [decision, setDecision] = useState<"APPROVE" | "REJECT" | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  const toast = useToast();
  useEffect(() => {
    if (!state.message) return;
    if (state.success) toast.success(state.message);
    else toast.error("ดำเนินการไม่สำเร็จ", state.message);
  }, [state.success, state.message, toast]);
  return <form ref={ref} action={action} className="mt-4 space-y-3"><input type="hidden" name="villageId" value={villageId} /><input type="hidden" name="requestId" value={requestId} /><input type="hidden" name="decision" value={decision ?? ""} /><textarea name="reason" required minLength={5} placeholder="เหตุผลการพิจารณา" className="min-h-24 w-full rounded-lg border p-3 text-sm" /><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setDecision("APPROVE")} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white">อนุมัติ</button><button type="button" onClick={() => setDecision("REJECT")} className="rounded-lg bg-rose-700 px-4 py-2 text-sm text-white">ปฏิเสธ</button></div><ConfirmDialog open={decision !== null} title={decision === "APPROVE" ? "ยืนยันอนุมัติการแก้ไข" : "ยืนยันปฏิเสธคำขอ"} description="ผลการพิจารณาและเหตุผลจะถูกแจ้งแก่ผู้ยื่นและบันทึกใน Audit Log" tone={decision === "REJECT" ? "danger" : "default"} pending={pending} onClose={() => setDecision(null)} onConfirm={() => { if (!ref.current?.reportValidity()) return; ref.current.requestSubmit(); setDecision(null); }} /></form>;
}
