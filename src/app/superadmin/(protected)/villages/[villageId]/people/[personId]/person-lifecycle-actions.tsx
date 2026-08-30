"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { validateOptionalPersonDate } from "@/lib/person-validation";
import { markSuperAdminPersonDeceasedAction, moveOutSuperAdminPersonAction } from "../../population-actions";

type Props = { villageId: string; personId: string };

export function SuperAdminPersonLifecycleActions({ villageId, personId }: Props) {
  const [dialog, setDialog] = useState<"moveOut" | "deceased" | null>(null);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const reasonValid = reason.trim().length >= 5;

  const close = () => { if (!pending) { setDialog(null); setError(""); } };
  const moveOut = () => {
    if (!reasonValid) return setError("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร");
    startTransition(async () => {
      const result = await moveOutSuperAdminPersonAction(villageId, personId, reason);
      if (!result.success) { setError(result.error); toast.error("ไม่สามารถย้ายออกได้", result.error); return; }
      toast.success(result.message); close(); router.refresh();
    });
  };
  const deceased = () => {
    const parsed = validateOptionalPersonDate(date);
    const dateError = !date ? "กรุณาระบุวันที่เสียชีวิต" : !parsed.valid ? parsed.reason === "FUTURE" ? "วันที่เสียชีวิตต้องไม่เป็นวันในอนาคต" : "วันที่เสียชีวิตไม่ถูกต้อง" : "";
    if (dateError || !reasonValid) return setError(dateError || "กรุณาระบุเหตุผลหรือหมายเหตุอย่างน้อย 5 ตัวอักษร");
    startTransition(async () => {
      const result = await markSuperAdminPersonDeceasedAction(villageId, personId, date, reason);
      if (!result.success) { setError(result.error); toast.error("ไม่สามารถบันทึกการเสียชีวิตได้", result.error); return; }
      toast.success(result.message); close(); router.refresh();
    });
  };

  return <>
    <Button type="button" variant="warning" className="min-h-11" onClick={() => { setError(""); setDialog("moveOut"); }}>ย้ายออก</Button>
    <Button type="button" variant="danger" className="min-h-11" onClick={() => { setError(""); setDialog("deceased"); }}>บันทึกการเสียชีวิต</Button>
    <ConfirmDialog open={dialog === "moveOut"} title="ย้ายบุคคลออกจากทะเบียน" description="การดำเนินการนี้จะยกเลิกการผูกบ้านและสิทธิ์ลูกบ้านของหมู่บ้านนี้ ผู้ใช้จะต้องขอผูกเลขบ้านใหม่หากกลับมาอยู่อีกครั้ง" confirmLabel="ยืนยันการย้ายออก" tone="danger" pending={pending} confirmDisabled={!reasonValid} onClose={close} onConfirm={moveOut}>
      <Textarea autoFocus label="เหตุผลในการดำเนินการ *" required value={reason} onChange={(event) => { setReason(event.target.value); setError(""); }} error={error || undefined} helperText="ระบุอย่างน้อย 5 ตัวอักษร" maxLength={300} rows={4} />
    </ConfirmDialog>
    <ConfirmDialog open={dialog === "deceased"} title="บันทึกการเสียชีวิต" description="การบันทึกนี้เป็นสถานะภายในระบบหมู่บ้าน และจะเก็บประวัติบุคคลไว้ ไม่ได้เป็นการแจ้งตายต่อหน่วยงานราชการ" confirmLabel="ยืนยันการบันทึก" tone="danger" pending={pending} confirmDisabled={!date || !reasonValid} onClose={close} onConfirm={deceased}>
      <div className="space-y-4"><Input label="วันที่เสียชีวิต" type="date" required value={date} onChange={(event) => { setDate(event.target.value); setError(""); }} error={error.includes("วันที่") ? error : undefined} max={new Date().toISOString().slice(0, 10)} /><Textarea label="เหตุผล / หมายเหตุ *" required value={reason} onChange={(event) => { setReason(event.target.value); setError(""); }} error={!error.includes("วันที่") ? error || undefined : undefined} helperText="ระบุข้อมูลประกอบอย่างน้อย 5 ตัวอักษร" maxLength={300} rows={4} /></div>
    </ConfirmDialog>
  </>;
}
