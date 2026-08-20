"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { adminCancelAppointmentAction, rejectAppointmentAction } from "@/app/(resident)/resident/appointments/actions";

type Props = { appointmentId: string; canReject: boolean; canCancel: boolean };

export function AppointmentStatusActions({ appointmentId, canReject, canCancel }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [rejectPending, setRejectPending] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);

  const submitReject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reason = rejectReason.trim();
    if (reason.length < 5) {
      setRejectError("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร");
      return;
    }
    setRejectError(null);
    setRejectPending(true);
    try {
      const formData = new FormData();
      formData.set("appointmentId", appointmentId);
      formData.set("reviewNote", reason);
      const result = await rejectAppointmentAction(formData);
      if (!result.success) {
        setRejectError(result.error);
        toast.error("ปฏิเสธคำขอนัดหมายไม่สำเร็จ", result.error);
        return;
      }
      toast.success("ปฏิเสธคำขอนัดหมายเรียบร้อยแล้ว");
      setRejectOpen(false);
      router.refresh();
    } catch {
      const message = "กรุณาลองใหม่อีกครั้ง";
      setRejectError(message);
      toast.error("ปฏิเสธคำขอนัดหมายไม่สำเร็จ", message);
    } finally {
      setRejectPending(false);
    }
  };

  const submitCancel = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reason = cancelReason.trim();
    if (reason.length < 5) {
      setCancelError("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร");
      return;
    }
    setCancelError(null);
    setCancelPending(true);
    try {
      const formData = new FormData();
      formData.set("appointmentId", appointmentId);
      formData.set("reason", reason);
      const result = await adminCancelAppointmentAction(formData);
      if (!result.success) {
        setCancelError(result.error);
        toast.error("ยกเลิกนัดหมายไม่สำเร็จ", result.error);
        return;
      }
      toast.success("ยกเลิกนัดหมายเรียบร้อยแล้ว");
      setCancelOpen(false);
      router.refresh();
    } catch {
      const message = "กรุณาลองใหม่อีกครั้ง";
      setCancelError(message);
      toast.error("ยกเลิกนัดหมายไม่สำเร็จ", message);
    } finally {
      setCancelPending(false);
    }
  };

  return <>
    {canReject ? <Button type="button" variant="danger" size="sm" onClick={() => setRejectOpen(true)}>ปฏิเสธคำขอ</Button> : null}
    {canCancel ? <Button type="button" variant="danger" size="sm" onClick={() => setCancelOpen(true)}>ยกเลิกนัดหมาย</Button> : null}

    <Dialog open={rejectOpen} onClose={() => { if (!rejectPending) setRejectOpen(false); }} closeOnBackdrop={false} title="ปฏิเสธคำขอนัดหมาย" description="กรุณาระบุเหตุผลเพื่อแจ้งให้ลูกบ้านทราบ" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={rejectPending} onClick={() => setRejectOpen(false)}>ยกเลิก</Button><Button type="submit" form="reject-appointment-form" variant="danger" isLoading={rejectPending} disabled={rejectReason.trim().length < 5}>ยืนยันปฏิเสธ</Button></div>}>
      <form id="reject-appointment-form" noValidate onSubmit={submitReject}>
        <Textarea label="เหตุผล" value={rejectReason} onChange={(event) => { setRejectReason(event.target.value); setRejectError(null); }} error={rejectError ?? undefined} helperText="อย่างน้อย 5 ตัวอักษร" required rows={4} maxLength={500} />
      </form>
    </Dialog>

    <Dialog open={cancelOpen} onClose={() => { if (!cancelPending) setCancelOpen(false); }} closeOnBackdrop={false} title="ยกเลิกนัดหมาย" description="กรุณาระบุเหตุผลในการยกเลิกนัดหมาย" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={cancelPending} onClick={() => setCancelOpen(false)}>ยกเลิก</Button><Button type="submit" form="cancel-appointment-form" variant="danger" isLoading={cancelPending} disabled={cancelReason.trim().length < 5}>ยืนยันยกเลิกนัดหมาย</Button></div>}>
      <form id="cancel-appointment-form" noValidate onSubmit={submitCancel}>
        <Textarea label="เหตุผล" value={cancelReason} onChange={(event) => { setCancelReason(event.target.value); setCancelError(null); }} error={cancelError ?? undefined} helperText="อย่างน้อย 5 ตัวอักษร" required rows={4} maxLength={500} />
      </form>
    </Dialog>
  </>;
}
