"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { approveOpeningRequestAction, rejectOpeningRequestAction } from "../actions";

export function OpeningRequestReviewActions({
  requestId,
  houseNumber,
  maskedEmail,
}: {
  requestId: string;
  houseNumber: string;
  maskedEmail: string;
}) {
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const approve = () => startTransition(async () => {
    const result = await approveOpeningRequestAction(requestId);
    if (!result.success) {
      toast.error("ไม่สามารถเปิดบัญชีบ้านได้", result.message);
      return;
    }
    setDialog(null);
    toast.success("ดำเนินการเรียบร้อย", result.message);
    router.refresh();
  });

  const reject = (reason: string) => startTransition(async () => {
    const result = await rejectOpeningRequestAction(requestId, reason);
    if (!result.success) {
      toast.error("ไม่สามารถปฏิเสธคำขอได้", result.message);
      return;
    }
    setDialog(null);
    toast.success("ดำเนินการเรียบร้อย", result.message);
    router.refresh();
  });

  return <>
    <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
      <Button type="button" variant="dangerOutline" disabled={pending} onClick={() => setDialog("reject")}>ปฏิเสธ</Button>
      <Button type="button" disabled={pending} onClick={() => setDialog("approve")}>อนุมัติและเปิดบัญชี</Button>
    </div>
    <ConfirmDialog
      open={dialog === "approve"}
      title={`ยืนยันการอนุมัติคำขอและเปิดบัญชีสำหรับบ้านเลขที่ ${houseNumber} ?`}
      confirmLabel="อนุมัติและเปิดบัญชี"
      pending={pending}
      onClose={() => setDialog(null)}
      onConfirm={approve}
    >
      <dl className="rounded-xl bg-slate-50 p-3 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-slate-500">บ้านเลขที่</dt><dd className="break-all text-right font-medium text-slate-900">{houseNumber}</dd></div>
        <div className="mt-2 flex justify-between gap-3"><dt className="text-slate-500">อีเมล</dt><dd className="break-all text-right font-medium text-slate-900">{maskedEmail}</dd></div>
      </dl>
    </ConfirmDialog>
    <ActionReasonDialog
      open={dialog === "reject"}
      action="house_account_opening.reject"
      title="ปฏิเสธคำขอ"
      description={`ระบุเหตุผลในการปฏิเสธคำขอเปิดบัญชีบ้านเลขที่ ${houseNumber}`}
      submitLabel="ปฏิเสธคำขอ"
      reasonLabel="เหตุผลในการปฏิเสธ"
      requireReason
      minReasonLength={1}
      maxReasonLength={2000}
      loading={pending}
      onCancel={() => setDialog(null)}
      onSubmit={reject}
    />
  </>;
}
