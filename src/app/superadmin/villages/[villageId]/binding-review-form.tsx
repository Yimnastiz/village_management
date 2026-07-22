"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { reviewBindingSupportAction, type BindingReviewActionState } from "./actions";

type HouseOption = { id: string; houseNumber: string };

function SubmitButton({ decision }: { decision: "APPROVE" | "REJECT" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="decision"
      value={decision}
      disabled={pending}
      className={`rounded px-3 py-1 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50 ${decision === "APPROVE" ? "bg-emerald-600" : "bg-red-600"}`}
    >
      {pending ? "กำลังดำเนินการ..." : decision === "APPROVE" ? "อนุมัติ" : "ปฏิเสธ"}
    </button>
  );
}

export function BindingReviewForm({
  villageId,
  villageName,
  requestId,
  proposed,
  houses,
}: {
  villageId: string;
  villageName: string;
  requestId: string;
  proposed: boolean;
  houses: HouseOption[];
}) {
  const initialState: BindingReviewActionState = { success: false };
  const [state, formAction, pending] = useActionState(reviewBindingSupportAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  function confirmSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (pending) {
      event.preventDefault();
      return;
    }
    if (!window.confirm(`กำลังดำเนินการแทนหมู่บ้าน “${villageName}”\nการดำเนินการนี้จะถูกบันทึกใน Audit Log`)) event.preventDefault();
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={confirmSubmit} className="mt-2 space-y-2">
      <input type="hidden" name="targetVillageId" value={villageId} />
      <input type="hidden" name="requestId" value={requestId} />
      {proposed ? (
        <label className="block text-sm text-slate-600">
          เลือกบ้านในทะเบียนเพื่อจับคู่ก่อนอนุมัติ
          <select name="selectedHouseId" defaultValue="" className="mt-1 w-full rounded border px-2 py-1 text-sm">
            <option value="">ยังไม่จับคู่บ้าน</option>
            {houses.map((house) => <option key={house.id} value={house.id}>{house.houseNumber}</option>)}
          </select>
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <input name="reason" required minLength={5} placeholder="เหตุผลการดำเนินการแทน (อย่างน้อย 5 ตัวอักษร)" className="min-w-48 flex-1 rounded border px-2 py-1 text-sm" />
        <SubmitButton decision="APPROVE" />
        <SubmitButton decision="REJECT" />
      </div>
      {state.message ? <p role="alert" className={`text-sm ${state.success ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p> : null}
    </form>
  );
}
