"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { Button } from "@/components/ui/button";
import { VisibilitySelector } from "@/components/ui/visibility-selector";
import { useToast } from "@/components/ui/toast";
import {
  adminApproveVillageEventSubmissionAction,
  adminRejectVillageEventSubmissionAction,
} from "../actions";

type ReviewFormData = { finalVisibility: "PUBLIC" | "RESIDENT" };

export function CalendarRequestReviewButtons({ requestId, requestedVisibility }: { requestId: string; requestedVisibility: "PUBLIC" | "RESIDENT" }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const { register, watch } = useForm<ReviewFormData>({ defaultValues: { finalVisibility: requestedVisibility } });
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finalVisibility = watch("finalVisibility");
  const isPending = isApproving || isRejecting;

  const onApprove = async () => {
    setIsApproving(true);
    setError(null);

    try {
      const result = await adminApproveVillageEventSubmissionAction(requestId, "", finalVisibility);
      if (!result.success) {
        setError(result.error);
        pushToast({ tone: "error", title: "อนุมัติคำขอไม่สำเร็จ", description: result.error });
        return;
      }

      pushToast({ tone: "success", title: "อนุมัติคำขอเรียบร้อยแล้ว" });
      router.push(`/admin/calendar/${result.eventId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "กรุณาลองใหม่อีกครั้ง";
      setError(message);
      pushToast({ tone: "error", title: "อนุมัติคำขอไม่สำเร็จ", description: message });
    } finally {
      setIsApproving(false);
    }
  };

  const onReject = async (reason: string) => {
    setIsRejecting(true);
    setError(null);

    try {
      const result = await adminRejectVillageEventSubmissionAction(requestId, reason);
      if (!result.success) {
        setError(result.error);
        pushToast({ tone: "error", title: "ปฏิเสธคำขอไม่สำเร็จ", description: result.error });
        return;
      }

      setIsRejectDialogOpen(false);
      pushToast({ tone: "success", title: "ปฏิเสธคำขอเรียบร้อยแล้ว" });
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "กรุณาลองใหม่อีกครั้ง";
      setError(message);
      pushToast({ tone: "error", title: "ปฏิเสธคำขอไม่สำเร็จ", description: message });
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="space-y-3">
      <VisibilitySelector
        publicInput={register("finalVisibility")}
        residentInput={register("finalVisibility")}
        residentValue="RESIDENT"
        helperId="calendar-request-final-visibility"
        label="การมองเห็นเมื่อเผยแพร่"
        disabled={isPending}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button onClick={onApprove} isLoading={isApproving} disabled={isPending} className="w-full sm:w-auto">อนุมัติ</Button>
        <Button variant="danger" onClick={() => { setError(null); setIsRejectDialogOpen(true); }} disabled={isPending} className="w-full sm:w-auto">ไม่อนุมัติ</Button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ActionReasonDialog
        open={isRejectDialogOpen}
        action="content.request.reject"
        title="ไม่อนุมัติคำขอกิจกรรม"
        description="คำขอจะถูกเก็บไว้ในประวัติพร้อมเหตุผลที่แจ้งแก่ผู้ส่งคำขอ"
        reasonLabel="เหตุผลที่ไม่อนุมัติ"
        invalidReasonMessage="กรุณาระบุเหตุผลที่ไม่อนุมัติ"
        submitLabel="ยืนยันไม่อนุมัติ"
        loading={isRejecting}
        onCancel={() => setIsRejectDialogOpen(false)}
        onSubmit={onReject}
      />
    </div>
  );
}
