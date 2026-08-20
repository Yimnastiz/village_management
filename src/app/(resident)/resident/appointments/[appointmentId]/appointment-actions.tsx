"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { cancelAppointmentAction, confirmSuggestionAction, rejectSuggestionAction, updateAppointmentRequestAction } from "../actions";

type Recipient = { id: string; name: string; role: string; roleLabel?: string };
type Props = { appointmentId: string; stage: string; editable: boolean; title: string; description: string; preferredTime: string; targetAdminUserId: string };

export function AppointmentActions({ appointmentId, stage, editable, title: initialTitle, description: initialDescription, preferredTime: initialPreferredTime, targetAdminUserId: initialTargetAdminUserId }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const submittingRef = useRef(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [preferredTime, setPreferredTime] = useState(initialPreferredTime);
  const [targetAdminUserId, setTargetAdminUserId] = useState(initialTargetAdminUserId);
  const [alternativeTime, setAlternativeTime] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [fieldError, setFieldError] = useState("");

  useEffect(() => {
    if (!editOpen || recipients.length) return;
    fetch("/api/appointments/admin-recipients").then((response) => response.ok ? response.json() : []).then((items: Recipient[]) => setRecipients(items)).catch(() => setRecipients([]));
  }, [editOpen, recipients.length]);

  const run = async (work: () => Promise<{ success: true } | { success: false; error: string }>, successTitle: string, close: () => void, failureTitle: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPending(true);
    try {
      const result = await work();
      if (!result.success) {
        toast.error(failureTitle, result.error);
        return;
      }
      close();
      toast.success(successTitle);
      router.refresh();
    } catch {
      toast.error(failureTitle, "กรุณาลองใหม่อีกครั้ง");
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  };

  const closeEdit = () => { if (!pending) { setEditOpen(false); setFieldError(""); } };
  const closeChange = () => { if (!pending) { setChangeOpen(false); setFieldError(""); } };
  const closeCancel = () => { if (!pending) { setCancelOpen(false); setFieldError(""); } };
  const canCancel = ["PENDING_APPROVAL", "TIME_SUGGESTED", "APPROVED"].includes(stage);

  return <section className="flex flex-wrap gap-2">
    {editable ? <Button type="button" variant="outline" onClick={() => setEditOpen(true)}><Pencil className="mr-1.5 h-4 w-4" />แก้ไขคำขอนัดหมาย</Button> : null}
    {stage === "TIME_SUGGESTED" ? <><Button type="button" onClick={() => run(() => confirmSuggestionAction(appointmentId), "ยืนยันนัดหมายเรียบร้อยแล้ว", () => undefined, "ยืนยันนัดหมายไม่สำเร็จ")} disabled={pending}><CheckCircle2 className="mr-1.5 h-4 w-4" />ยืนยันนัดหมาย</Button><Button type="button" variant="outline" onClick={() => setChangeOpen(true)} disabled={pending}><RotateCcw className="mr-1.5 h-4 w-4" />ขอเปลี่ยนเวลา</Button></> : null}
    {canCancel ? <Button type="button" variant="danger" onClick={() => setCancelOpen(true)} disabled={pending}><XCircle className="mr-1.5 h-4 w-4" />ยกเลิกนัดหมาย</Button> : null}

    <Dialog open={editOpen} onClose={closeEdit} closeOnBackdrop={false} closeOnEscape={false} title="แก้ไขคำขอนัดหมาย" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={pending} onClick={closeEdit}>ยกเลิก</Button><Button type="submit" form="resident-edit-appointment" isLoading={pending}>บันทึก</Button></div>}>
      <form id="resident-edit-appointment" className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (title.trim().length < 3) { setFieldError("กรุณาระบุเรื่องอย่างน้อย 3 ตัวอักษร"); return; } void run(() => updateAppointmentRequestAction(appointmentId, { title, description, preferredTime, targetAdminUserId: targetAdminUserId || undefined }), "บันทึกคำขอนัดหมายเรียบร้อยแล้ว", closeEdit, "บันทึกคำขอนัดหมายไม่สำเร็จ"); }}>
        {recipients.length ? <Select label="ผู้ที่ต้องการนัด" value={targetAdminUserId} onChange={(event) => setTargetAdminUserId(event.target.value)} placeholder="เลือกผู้ดูแลหมู่บ้าน (ไม่บังคับ)" options={recipients.map((item) => ({ value: item.id, label: `${item.name} (${item.roleLabel ?? item.role})` }))} /> : null}
        <Input label="เรื่อง" required minLength={3} value={title} error={fieldError} onChange={(event) => { setTitle(event.target.value); if (fieldError) setFieldError(""); }} />
        <Textarea label="รายละเอียด" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
        <Input label="ช่วงเวลาที่สะดวก" value={preferredTime} onChange={(event) => setPreferredTime(event.target.value)} placeholder="เช่น วันธรรมดาช่วงเย็น" />
      </form>
    </Dialog>

    <Dialog open={changeOpen} onClose={closeChange} closeOnBackdrop={false} closeOnEscape={false} title="ขอเปลี่ยนเวลานัดหมาย" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={pending} onClick={closeChange}>ยกเลิก</Button><Button type="submit" form="resident-change-appointment-time" isLoading={pending}>ส่งคำขอเปลี่ยนเวลา</Button></div>}>
      <form id="resident-change-appointment-time" onSubmit={(event) => { event.preventDefault(); if (alternativeTime.trim().length < 10) { setFieldError("กรุณาระบุช่วงเวลาที่สะดวกอย่างน้อย 10 ตัวอักษร"); return; } void run(() => rejectSuggestionAction(appointmentId, alternativeTime), "ส่งคำขอเปลี่ยนเวลาเรียบร้อยแล้ว", closeChange, "ส่งคำขอเปลี่ยนเวลาไม่สำเร็จ"); }}>
        <Textarea label="ช่วงเวลาที่คุณสะดวก" required value={alternativeTime} error={fieldError} helperText="อย่างน้อย 10 ตัวอักษร" onChange={(event) => { setAlternativeTime(event.target.value); if (fieldError) setFieldError(""); }} rows={4} />
      </form>
    </Dialog>

    <Dialog open={cancelOpen} onClose={closeCancel} closeOnBackdrop={false} closeOnEscape={false} title="ยกเลิกนัดหมาย" description="กรุณาระบุเหตุผลในการยกเลิกนัดหมาย" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={pending} onClick={closeCancel}>ยกเลิก</Button><Button type="submit" variant="danger" form="resident-cancel-appointment" isLoading={pending} disabled={cancelReason.trim().length < 5}>ยืนยันยกเลิกนัดหมาย</Button></div>}>
      <form id="resident-cancel-appointment" onSubmit={(event) => { event.preventDefault(); if (cancelReason.trim().length < 5) { setFieldError("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร"); return; } void run(() => cancelAppointmentAction(appointmentId, cancelReason), "ยกเลิกนัดหมายเรียบร้อยแล้ว", closeCancel, "ยกเลิกนัดหมายไม่สำเร็จ"); }}>
        <Textarea label="เหตุผล" required value={cancelReason} error={fieldError} helperText="อย่างน้อย 5 ตัวอักษร" onChange={(event) => { setCancelReason(event.target.value); if (fieldError) setFieldError(""); }} rows={4} />
      </form>
    </Dialog>
  </section>;
}
