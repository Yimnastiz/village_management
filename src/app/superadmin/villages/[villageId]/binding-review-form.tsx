"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useToast } from "@/components/ui/toast";
import { reviewBindingSupportAction, type BindingReviewActionState } from "./actions";

type HouseOption = { id: string; houseNumber: string };

function SubmitButton({ decision }: { decision: "APPROVE" | "REJECT" }) {
  const { pending } = useFormStatus();
  return <button type="submit" name="decision" value={decision} disabled={pending} className={`min-h-10 rounded-lg px-3 text-sm font-medium text-white disabled:opacity-50 ${decision === "APPROVE" ? "bg-emerald-700" : "bg-rose-700"}`}>{pending ? "กำลังบันทึก..." : decision === "APPROVE" ? "อนุมัติ" : "ปฏิเสธ"}</button>;
}

export function BindingReviewForm({ villageId, villageName, requestId, proposed, houses }: { villageId: string; villageName: string; requestId: string; proposed: boolean; houses: HouseOption[] }) {
  const [state, formAction] = useActionState(reviewBindingSupportAction, { success: false } as BindingReviewActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();
  useEffect(() => {
    if (!state.message) return;
    if (state.success) { formRef.current?.reset(); toast.success(state.message); }
    else toast.error("ดำเนินการไม่สำเร็จ", state.message);
  }, [state.success, state.message, toast]);
  return <form ref={formRef} action={formAction} className="mt-3 space-y-3" aria-label={`ตรวจคำขอผูกบ้านของ ${villageName}`}>
    <input type="hidden" name="targetVillageId" value={villageId} />
    <input type="hidden" name="requestId" value={requestId} />
    {proposed ? <label className="block text-sm text-slate-600">จับคู่บ้านในทะเบียนก่อนอนุมัติ<select name="selectedHouseId" defaultValue="" className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="">ยังไม่จับคู่บ้าน</option>{houses.map((house) => <option key={house.id} value={house.id}>{house.houseNumber}</option>)}</select></label> : null}
    <div className="flex flex-col gap-2 sm:flex-row">
      <input name="reason" required minLength={5} placeholder="เหตุผลการดำเนินการ (อย่างน้อย 5 ตัวอักษร)" className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm" />
      <div className="flex gap-2"><SubmitButton decision="APPROVE" /><SubmitButton decision="REJECT" /></div>
    </div>
  </form>;
}
