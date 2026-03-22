"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock, AlertCircle, Info } from "lucide-react";
import { confirmSuggestionAction, rejectSuggestionAction } from "../actions";

interface Props {
  appointmentId: string;
  stage: string;
  suggestionMessage: string | null;
  wasRejectedSuggestion: boolean;
}

export function AppointmentActions({ appointmentId, stage, suggestionMessage, wasRejectedSuggestion }: Props) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (stage === "TIME_SUGGESTED") {
    const handleConfirm = async () => {
      setIsConfirming(true);
      setError(null);
      const result = await confirmSuggestionAction(appointmentId);
      if (!result.success) {
        setError(result.error);
        setIsConfirming(false);
        return;
      }
      router.refresh();
    };

    const handleReject = async () => {
      setIsRejecting(true);
      setError(null);
      const result = await rejectSuggestionAction(appointmentId);
      if (!result.success) {
        setError(result.error);
        setIsRejecting(false);
        return;
      }
      router.refresh();
    };

    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-blue-900">ผู้บริหารแนะนำเวลาใหม่</p>
            <p className="text-sm text-blue-700 mt-1">
              กรุณายืนยันหรือปฏิเสธเวลานัดหมายที่ผู้บริหารแนะนำด้านบน
            </p>
            {suggestionMessage && (
              <p className="text-sm text-blue-800 mt-2 italic">"{suggestionMessage}"</p>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            onClick={handleConfirm}
            isLoading={isConfirming}
            disabled={isRejecting}
            className="flex-1"
          >
            <CheckCircle className="h-4 w-4 mr-1" /> ยืนยันเวลานี้
          </Button>
          <Button
            onClick={handleReject}
            isLoading={isRejecting}
            disabled={isConfirming}
            variant="outline"
            className="flex-1"
          >
            <XCircle className="h-4 w-4 mr-1" /> ปฏิเสธและยกเลิก
          </Button>
        </div>
      </div>
    );
  }

  if (stage === "PENDING_APPROVAL") {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          รออนุมัติจากผู้บริหาร คุณสามารถตรวจสอบสถานะได้ที่นี่
        </p>
      </div>
    );
  }

  if (stage === "CANCELLED" && wasRejectedSuggestion) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 space-y-3">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-orange-900">คุณปฏิเสธเวลาที่แนะนำแล้ว</p>
            <p className="text-sm text-orange-700 mt-1">
              หากต้องการนัดหมายใหม่ กรุณาสร้างคำขอนัดหมายใหม่
            </p>
          </div>
        </div>
        <a
          href="/resident/appointments/new"
          className="inline-flex items-center gap-2 text-sm font-medium text-orange-800 underline hover:text-orange-600"
        >
          ขอจองนัดหมายใหม่
        </a>
      </div>
    );
  }

  return null;
}
