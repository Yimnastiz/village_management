"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  adminApproveGalleryItemSubmissionAction,
  adminRejectGalleryItemSubmissionAction,
} from "../actions";

export function GallerySubmissionReviewButtons({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onApprove = async () => {
    const reviewNote = window.prompt("หมายเหตุถึงผู้ส่งคำขอ (ไม่บังคับ)") || "";
    setIsApproving(true);
    setError(null);

    const result = await adminApproveGalleryItemSubmissionAction(submissionId, reviewNote);

    setIsApproving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }

    router.refresh();
  };

  const onReject = async () => {
    const reviewNote = window.prompt("ระบุเหตุผลที่ไม่อนุมัติ") || "";
    setIsRejecting(true);
    setError(null);

    const result = await adminRejectGalleryItemSubmissionAction(submissionId, reviewNote);

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
