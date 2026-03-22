"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { adminApproveNewsSubmissionAction, adminRejectNewsSubmissionAction } from "../actions";

export function RequestReviewButtons({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onApprove = async () => {
    const reviewNote = prompt("หมายเหตุถึงผู้ส่งคำขอ (ไม่บังคับ)") || "";
    setIsApproving(true);
    setError(null);
    const result = await adminApproveNewsSubmissionAction(requestId, reviewNote);
    setIsApproving(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.push(`/admin/news/${result.newsId}`);
    router.refresh();
  };

  const onReject = async () => {
    const reviewNote = prompt("ระบุเหตุผลที่ไม่อนุมัติ") || "";
    setIsRejecting(true);
    setError(null);
    const result = await adminRejectNewsSubmissionAction(requestId, reviewNote);
    setIsRejecting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.refresh();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button onClick={onApprove} isLoading={isApproving}>อนุมัติ</Button>
        <Button variant="danger" onClick={onReject} isLoading={isRejecting}>ไม่อนุมัติ</Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
