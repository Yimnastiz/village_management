"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  adminApproveVillageEventSubmissionAction,
  adminRejectVillageEventSubmissionAction,
} from "../actions";

export function CalendarRequestReviewButtons({ requestId, requestedVisibility }: { requestId: string; requestedVisibility: "PUBLIC" | "RESIDENT" }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [finalVisibility, setFinalVisibility] = useState<"PUBLIC" | "RESIDENT">(requestedVisibility);
  const [error, setError] = useState<string | null>(null);
  const isPending = isApproving || isRejecting;

  const onApprove = async () => {
    setIsApproving(true);
    setError(null);

    try {
      const result = await adminApproveVillageEventSubmissionAction(requestId, reviewNote, finalVisibility);
      if (!result.success) {
        setError(result.error);
        pushToast({ tone: "error", title: "อนุมัติคำขอไม่สำเร็จ", description: result.error });
        return;
      }

      setReviewNote("");
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

  const onReject = async () => {
    setIsRejecting(true);
    setError(null);

    try {
      const result = await adminRejectVillageEventSubmissionAction(requestId, reviewNote);
      if (!result.success) {
        setError(result.error);
        pushToast({ tone: "error", title: "ปฏิเสธคำขอไม่สำเร็จ", description: result.error });
        return;
      }

      setReviewNote("");
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
      <Select
        label="การมองเห็นเมื่อเผยแพร่"
        value={finalVisibility}
        onChange={(event) => setFinalVisibility(event.target.value as "PUBLIC" | "RESIDENT")}
        disabled={isPending}
        options={[
          { value: "RESIDENT", label: "เฉพาะลูกบ้าน" },
          { value: "PUBLIC", label: "สาธารณะ" },
        ]}
      />
      <Textarea
        label="หมายเหตุถึงผู้ส่งคำขอ"
        value={reviewNote}
        onChange={(event) => setReviewNote(event.target.value)}
        rows={3}
        disabled={isPending}
        placeholder="ไม่บังคับ ยกเว้นกรณีไม่อนุมัติควรระบุเหตุผล"
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button onClick={onApprove} isLoading={isApproving} disabled={isPending} className="w-full sm:w-auto">อนุมัติ</Button>
        <Button variant="danger" onClick={onReject} isLoading={isRejecting} disabled={isPending} className="w-full sm:w-auto">ไม่อนุมัติ</Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
