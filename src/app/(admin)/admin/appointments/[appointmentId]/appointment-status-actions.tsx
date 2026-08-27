"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { useToast } from "@/components/ui/toast";
import { adminCancelAppointmentAction, rejectAppointmentAction } from "@/app/(resident)/resident/appointments/actions";

type Props = { appointmentId: string; canReject: boolean; canCancel: boolean };

export function AppointmentStatusActions({ appointmentId, canReject, canCancel }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rejectPending, setRejectPending] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);

  const submitReject = async (reason: string) => {
    setRejectPending(true);
    try {
      const formData = new FormData();
      formData.set("appointmentId", appointmentId);
      formData.set("reviewNote", reason);
      const result = await rejectAppointmentAction(formData);
      if (!result.success) {
        toast.error("ปฏิเสธคำขอนัดหมายไม่สำเร็จ", result.error);
        return;
      }
      toast.success("ปฏิเสธคำขอนัดหมายเรียบร้อยแล้ว");
      setRejectOpen(false);
      router.refresh();
    } catch {
      const message = "กรุณาลองใหม่อีกครั้ง";
      toast.error("ปฏิเสธคำขอนัดหมายไม่สำเร็จ", message);
    } finally {
      setRejectPending(false);
    }
  };

  const submitCancel = async (reason: string) => {
    setCancelPending(true);
    try {
      const formData = new FormData();
      formData.set("appointmentId", appointmentId);
      formData.set("reason", reason);
      const result = await adminCancelAppointmentAction(formData);
      if (!result.success) {
        toast.error("ยกเลิกนัดหมายไม่สำเร็จ", result.error);
        return;
      }
      toast.success("ยกเลิกนัดหมายเรียบร้อยแล้ว");
      setCancelOpen(false);
      router.refresh();
    } catch {
      const message = "กรุณาลองใหม่อีกครั้ง";
      toast.error("ยกเลิกนัดหมายไม่สำเร็จ", message);
    } finally {
      setCancelPending(false);
    }
  };

  return <>
    {canReject ? <Button type="button" variant="danger" size="sm" onClick={() => setRejectOpen(true)}>ปฏิเสธคำขอ</Button> : null}
    {canCancel ? <Button type="button" variant="danger" size="sm" onClick={() => setCancelOpen(true)}>ยกเลิกนัดหมาย</Button> : null}

    <ActionReasonDialog open={rejectOpen} action="appointment.reject_time" title="ปฏิเสธคำขอนัดหมาย" description="กรุณาระบุเหตุผลเพื่อแจ้งให้ลูกบ้านทราบ" submitLabel="ยืนยันปฏิเสธ" loading={rejectPending} onCancel={() => setRejectOpen(false)} onSubmit={submitReject} />
    <ActionReasonDialog open={cancelOpen} action="appointment.cancel" title="ยกเลิกนัดหมาย" description="กรุณาระบุเหตุผลในการยกเลิกนัดหมาย" submitLabel="ยืนยันยกเลิกนัดหมาย" loading={cancelPending} onCancel={() => setCancelOpen(false)} onSubmit={submitCancel} />
  </>;
}
