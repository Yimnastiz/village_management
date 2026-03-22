"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cancelAppointmentAction } from "./actions";

interface ResidentAppointmentCardProps {
  id: string;
  title: string;
  stage: string;
  stageLabel: string;
  stageVariant: "default" | "info" | "success" | "warning" | "danger";
  slotDate: string | null;
  slotStartTime: string | null;
  slotEndTime: string | null;
}

function formatThaiDateFromDateStr(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ResidentAppointmentCard(props: ResidentAppointmentCardProps) {
  const router = useRouter();
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canCancel = ["PENDING_APPROVAL", "TIME_SUGGESTED", "APPROVED"].includes(props.stage);

  const onSubmitCancel = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await cancelAppointmentAction(props.id, reason);
    if (!result.success) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    setReason("");
    setShowCancelForm(false);
    setIsSubmitting(false);
    router.refresh();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/resident/appointments/${props.id}`} className="font-medium text-gray-900 hover:underline">
            {props.title}
          </Link>
          {props.slotDate ? (
            <p className="text-xs text-gray-500 mt-0.5">
              วันที่: {formatThaiDateFromDateStr(props.slotDate)} เวลา {props.slotStartTime} - {props.slotEndTime}
            </p>
          ) : (
            <p className="text-xs text-gray-500 mt-0.5">รอการเลือกเวลา</p>
          )}
        </div>
        <Badge variant={props.stageVariant}>{props.stageLabel}</Badge>
      </div>

      <div className="flex items-center gap-2">
        <Link href={`/resident/appointments/${props.id}`}>
          <Button size="sm" variant="outline">ดูรายละเอียด</Button>
        </Link>
        {canCancel && (
          <Button
            size="sm"
            variant="outline"
            className="border-red-200 text-red-700 hover:bg-red-50"
            onClick={() => setShowCancelForm((v) => !v)}
          >
            ยกเลิกนัดหมาย
          </Button>
        )}
      </div>

      {showCancelForm && canCancel && (
        <form onSubmit={onSubmitCancel} className="space-y-2 border border-red-100 bg-red-50 rounded-lg p-3">
          <Textarea
            label="เหตุผลการยกเลิก"
            placeholder="กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
          {error && <p className="text-xs text-red-700">{error}</p>}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="danger" isLoading={isSubmitting} type="submit">
              ยืนยันยกเลิก
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => {
                setShowCancelForm(false);
                setError(null);
              }}
            >
              ปิด
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
