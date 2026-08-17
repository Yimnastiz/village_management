"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { moveOutPersonAction } from "./actions";

export function MoveOutPersonButton({ personId }: { personId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const reasonLength = reason.trim().length;
  const reasonHint = reasonLength < 5 ? `กรุณาระบุอย่างน้อย 5 ตัวอักษร (ต้องการอีก ${5 - reasonLength} ตัวอักษร)` : "";

  const submit = () => {
    if (reasonLength < 5) {
      setError("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร");
      return;
    }
    startTransition(async () => {
      const result = await moveOutPersonAction(personId, reason);
      if (!result.success) {
        setError(result.error);
        toast.error("ไม่สามารถย้ายออกได้", result.error);
        return;
      }
      toast.success("ย้ายบุคคลออกจากทะเบียนแล้ว");
      setOpen(false);
      router.push("/admin/population/people");
      router.refresh();
    });
  };

  return <>
    <Button variant="warning" className="min-h-11" onClick={() => { setError(""); setOpen(true); }}>ย้ายออก</Button>
    <ConfirmDialog
      open={open}
      title="ย้ายบุคคลออกจากทะเบียน"
      description="การดำเนินการนี้จะยกเลิกการผูกบ้านและสิทธิ์ลูกบ้านของหมู่บ้านนี้ ผู้ใช้จะต้องขอผูกเลขบ้านใหม่หากกลับมาอยู่อีกครั้ง"
      confirmLabel="ยืนยันการย้ายออก"
      tone="danger"
      pending={pending}
      confirmDisabled={reasonLength < 5}
      onClose={() => { if (!pending) setOpen(false); }}
      onConfirm={submit}
    >
      <Textarea
        autoFocus
        label="เหตุผลการย้ายออก"
        required
        value={reason}
        onChange={(event) => { setReason(event.target.value); setError(""); }}
        error={error || undefined}
        helperText={reasonHint || ""}
        maxLength={300}
        rows={4}
      />
    </ConfirmDialog>
  </>;
}
