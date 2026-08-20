"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { requestAppointmentAction } from "./actions";

type Recipient = { id: string; name: string; role: string; roleLabel?: string };

export function RequestAppointmentButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [targetAdminUserId, setTargetAdminUserId] = useState("");
  const [titleError, setTitleError] = useState("");
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const submittingRef = useRef(false);
  const toast = useToast();

  useEffect(() => {
    if (!open || recipients.length) return;
    fetch("/api/appointments/admin-recipients")
      .then((response) => response.ok ? response.json() : [])
      .then((items: Recipient[]) => setRecipients(items.filter((item) => Boolean(item.id)).filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index)))
      .catch(() => setRecipients([]));
  }, [open, recipients.length]);

  const close = () => {
    if (pending) return;
    setOpen(false);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3) {
      setTitleError("กรุณาระบุเรื่องอย่างน้อย 3 ตัวอักษร");
      return;
    }

    submittingRef.current = true;
    setPending(true);
    setFormError("");
    setTitleError("");
    try {
      const result = await requestAppointmentAction({ title: trimmedTitle, description, preferredTime, targetAdminUserId: targetAdminUserId || undefined });
      if (!result.success) {
        setFormError(result.error);
        toast.error("ส่งคำขอนัดหมายไม่สำเร็จ", result.error);
        return;
      }
      setTitle("");
      setDescription("");
      setPreferredTime("");
      setTargetAdminUserId("");
      setOpen(false);
      toast.success("ส่งคำขอนัดหมายเรียบร้อยแล้ว");
      router.refresh();
    } catch {
      const message = "กรุณาลองใหม่อีกครั้ง";
      setFormError(message);
      toast.error("ส่งคำขอนัดหมายไม่สำเร็จ", message);
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  };

  return <>
    <Button type="button" size="sm" className="h-10 px-2 sm:px-3" onClick={() => setOpen(true)}>
      <Plus className="mr-1 h-4 w-4" /><span className="hidden min-[390px]:inline">ขอนัดหมาย</span>
    </Button>
    <Dialog open={open} onClose={close} closeOnBackdrop={false} closeOnEscape={false} title="ขอนัดหมาย" description="ผู้ดูแลหมู่บ้านจะเสนอวันเวลาที่เหมาะสมให้คุณยืนยัน" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={pending} onClick={close}>ยกเลิก</Button><Button type="submit" form="resident-request-appointment-form" isLoading={pending}>ส่งคำขอนัดหมาย</Button></div>}>
      <form id="resident-request-appointment-form" className="space-y-4" onSubmit={submit}>
        {recipients.length > 0 ? <Select label="ผู้ที่ต้องการนัด" value={targetAdminUserId} onChange={(event) => setTargetAdminUserId(event.target.value)} placeholder="เลือกผู้ดูแลหมู่บ้าน (ไม่บังคับ)" options={recipients.map((item) => ({ value: item.id, label: `${item.name} (${item.roleLabel ?? item.role})` }))} /> : null}
        <Input label="เรื่อง" value={title} onChange={(event) => { setTitle(event.target.value); if (titleError) setTitleError(""); }} required minLength={3} error={titleError} />
        <Textarea label="รายละเอียด" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
        <Input label="ช่วงเวลาที่สะดวก" value={preferredTime} onChange={(event) => setPreferredTime(event.target.value)} placeholder="เช่น วันธรรมดาช่วงเย็น" />
        {formError ? <p className="text-sm text-red-600" role="alert">{formError}</p> : null}
      </form>
    </Dialog>
  </>;
}
