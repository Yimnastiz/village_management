"use client";

import { useActionState, useEffect, useState } from "react";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { useToast } from "@/components/ui/toast";
import { reviewCorrectionAction, type CorrectionActionState } from "./correction-actions";

export function CorrectionReviewForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(reviewCorrectionAction, { success: false } as CorrectionActionState);
  const [rejectOpen, setRejectOpen] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!state.message) return;
    if (state.success) toast.success(state.message);
    else toast.error("ดำเนินการไม่สำเร็จ", state.message);
  }, [state, toast]);

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <form action={action}>
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="decision" value="APPROVE" />
        <button disabled={pending} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50">
          {pending ? "กำลังดำเนินการ..." : "อนุมัติ"}
        </button>
      </form>
      <button type="button" onClick={() => setRejectOpen(true)} className="rounded-lg bg-rose-700 px-4 py-2 text-sm text-white">
        ปฏิเสธ
      </button>
      <ActionReasonDialog
        open={rejectOpen}
        action="population.correction.reject"
        title="ปฏิเสธคำขอแก้ไขข้อมูล"
        description="เหตุผลจะถูกแจ้งแก่ผู้ยื่นคำขอและบันทึกใน Audit Log"
        submitLabel="ยืนยันการปฏิเสธ"
        loading={pending}
        onCancel={() => setRejectOpen(false)}
        onSubmit={async (reason) => {
          const data = new FormData();
          data.set("requestId", requestId);
          data.set("decision", "REJECT");
          data.set("reason", reason);
          action(data);
        }}
      />
    </div>
  );
}
