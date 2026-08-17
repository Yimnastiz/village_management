"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { validateOptionalPersonDate } from "@/lib/person-validation";
import { markPersonDeceasedAction } from "./actions";

export function MarkDeceasedPersonButton({ personId }: { personId: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [dateError, setDateError] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const submit = () => {
    const parsedDate = validateOptionalPersonDate(date);
    const nextDateError = !date ? "กรุณาระบุวันที่เสียชีวิต" : !parsedDate.valid ? (parsedDate.reason === "FUTURE" ? "วันที่เสียชีวิตต้องไม่เป็นวันในอนาคต" : "วันที่เสียชีวิตไม่ถูกต้อง") : "";
    const nextReasonError = reason.trim().length < 5 ? "กรุณาระบุเหตุผลหรือหมายเหตุอย่างน้อย 5 ตัวอักษร" : "";
    setDateError(nextDateError);
    setReasonError(nextReasonError);
    if (nextDateError || nextReasonError) return;
    startTransition(async () => {
      const result = await markPersonDeceasedAction(personId, date, reason);
      if (!result.success) {
        toast.error("ไม่สามารถบันทึกการเสียชีวิตได้", result.error);
        if (result.error.includes("วันที่")) setDateError(result.error);
        else setReasonError(result.error);
        return;
      }
      toast.success("บันทึกสถานะเสียชีวิตแล้ว");
      setOpen(false);
      router.refresh();
    });
  };

  return <>
    <Button type="button" variant="danger" className="min-h-11" onClick={() => { setDateError(""); setReasonError(""); setOpen(true); }}>บันทึกการเสียชีวิต</Button>
    <ConfirmDialog
      open={open}
      title="บันทึกการเสียชีวิต"
      description="การบันทึกนี้เป็นสถานะภายในระบบหมู่บ้าน และจะเก็บประวัติบุคคลไว้ ไม่ได้เป็นการแจ้งตายต่อหน่วยงานราชการ"
      confirmLabel="ยืนยันการบันทึก"
      tone="danger"
      pending={pending}
      confirmDisabled={!date || reason.trim().length < 5}
      onClose={() => { if (!pending) setOpen(false); }}
      onConfirm={submit}
    >
      <div className="space-y-4">
        <Input label="วันที่เสียชีวิต" type="date" required value={date} onChange={(event) => { setDate(event.target.value); setDateError(""); }} error={dateError || undefined} max={new Date().toISOString().slice(0, 10)} />
        <Textarea label="เหตุผล / หมายเหตุ" required value={reason} onChange={(event) => { setReason(event.target.value); setReasonError(""); }} error={reasonError || undefined} helperText="ระบุข้อมูลประกอบอย่างน้อย 5 ตัวอักษร" maxLength={300} rows={4} />
      </div>
    </ConfirmDialog>
  </>;
}
