"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { adminUpdateAppointmentAction } from "@/app/(resident)/resident/appointments/actions";

type Props = {
  appointmentId: string;
  mode: "PROPOSE_TIME" | "EDIT_ADMIN_CREATED";
  initialTitle: string;
  initialDescription: string;
  initialDate: string;
  initialStartTime: string;
};

export function ProposeTimeForm({ appointmentId, mode, initialTitle, initialDescription, initialDate, initialStartTime }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isProposal = mode === "PROPOSE_TIME";

  const close = () => {
    if (!pending) {
      setOpen(false);
      setError(null);
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = isProposal
        ? await adminUpdateAppointmentAction({ mode, appointmentId, date, startTime })
        : await adminUpdateAppointmentAction({ mode, appointmentId, title, description, date, startTime });
      if (!result.success) {
        setError(result.error);
        toast.error(isProposal ? "เสนอวันเวลาไม่สำเร็จ" : "บันทึกการแก้ไขไม่สำเร็จ", result.error);
        return;
      }
      toast.success(isProposal ? "เสนอวันเวลาเรียบร้อยแล้ว" : "บันทึกการแก้ไขเรียบร้อยแล้ว");
      setOpen(false);
      router.refresh();
    } catch {
      const message = "กรุณาลองใหม่อีกครั้ง";
      setError(message);
      toast.error(isProposal ? "เสนอวันเวลาไม่สำเร็จ" : "บันทึกการแก้ไขไม่สำเร็จ", message);
    } finally {
      setPending(false);
    }
  };

  return <>
    <Button type="button" onClick={() => setOpen(true)}>{isProposal ? "เสนอวันเวลา" : "แก้ไขนัดหมาย"}</Button>
    <Dialog open={open} onClose={close} title={isProposal ? "เสนอวันเวลา" : "แก้ไขนัดหมาย"} description={isProposal ? "ส่งวันและเวลาที่ต้องการให้ลูกบ้านยืนยัน" : undefined} footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={pending} onClick={close}>ยกเลิก</Button><Button type="submit" form="appointment-edit-form" isLoading={pending}>{isProposal ? "ส่งเวลาให้ลูกบ้าน" : "บันทึกการแก้ไข"}</Button></div>}>
      <form id="appointment-edit-form" className="space-y-4" onSubmit={submit}>
        {isProposal ? null : <><Input label="เรื่องนัดหมาย" value={title} onChange={(event) => setTitle(event.target.value)} required minLength={3} /><Textarea label="รายละเอียด" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></>}
        <div className="grid gap-4 sm:grid-cols-2"><Input label="วันที่ *" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /><Input label="เวลา *" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required max="23:00" /></div>
        {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
      </form>
    </Dialog>
  </>;
}
