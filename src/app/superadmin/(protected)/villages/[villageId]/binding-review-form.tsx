"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { reviewBindingSupportAction, type BindingReviewActionState } from "./actions";

type HouseOption = { id: string; houseNumber: string };
export function BindingReviewForm({ villageId, villageName, requestId, proposed, houses, reviewAction = reviewBindingSupportAction }: { villageId: string; villageName: string; requestId: string; proposed: boolean; houses: HouseOption[]; reviewAction?: typeof reviewBindingSupportAction }) {
  const [state, formAction, pending] = useActionState(reviewAction, { success: false } as BindingReviewActionState);
  const ref = useRef<HTMLFormElement>(null);
  const [decision, setDecision] = useState<"APPROVE" | "REJECT" | null>(null);
  const toast = useToast();
  useEffect(() => {
    if (!state.message) return;
    if (state.success) { ref.current?.reset(); toast.success(state.message); }
    else toast.error("ดำเนินการไม่สำเร็จ", state.message);
  }, [state.success, state.message, toast]);
  return <form ref={ref} action={formAction} className="mt-4 space-y-3" aria-label={`ตรวจคำขอของ ${villageName}`}>
    <input type="hidden" name="targetVillageId" value={villageId} /><input type="hidden" name="requestId" value={requestId} /><input type="hidden" name="decision" value={decision ?? ""} />
    {proposed ? <label className="block text-sm text-slate-600">จับคู่บ้านในทะเบียนก่อนอนุมัติ<select name="selectedHouseId" defaultValue="" className="mt-1 min-h-10 w-full rounded-lg border bg-white px-3"><option value="">ยังไม่จับคู่บ้าน</option>{houses.map((house) => <option key={house.id} value={house.id}>{house.houseNumber}</option>)}</select></label> : null}
    <div className="flex flex-col gap-2 sm:flex-row"><input name="reason" required minLength={5} placeholder="เหตุผลการดำเนินการ (อย่างน้อย 5 ตัวอักษร)" className="min-h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm" /><div className="flex gap-2"><button type="button" disabled={pending} onClick={() => setDecision("APPROVE")} className="min-h-10 rounded-lg bg-emerald-700 px-3 text-sm font-medium text-white disabled:opacity-50">อนุมัติ</button><button type="button" disabled={pending} onClick={() => setDecision("REJECT")} className="min-h-10 rounded-lg bg-rose-700 px-3 text-sm font-medium text-white disabled:opacity-50">ปฏิเสธ</button></div></div>
    <ConfirmDialog open={decision !== null} title={decision === "APPROVE" ? "ยืนยันอนุมัติคำขอ" : "ยืนยันปฏิเสธคำขอ"} description={decision === "APPROVE" ? "บัญชีผู้ยื่นจะถูกผูกกับบ้านที่ตรวจสอบแล้วในหมู่บ้านนี้" : "คำขอจะถูกปฏิเสธและผู้ยื่นจะได้รับแจ้งเหตุผล"} confirmLabel={decision === "APPROVE" ? "ยืนยันอนุมัติ" : "ยืนยันปฏิเสธ"} tone={decision === "REJECT" ? "danger" : "default"} pending={pending} onClose={() => setDecision(null)} onConfirm={() => { const form = ref.current; if (!form?.reportValidity()) return; form.requestSubmit(); setDecision(null); }} />
  </form>;
}
