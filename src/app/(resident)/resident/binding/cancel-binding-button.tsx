"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cancelBindingRequestAction } from "./actions";

export function CancelBindingButton() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  return <>
    <Button type="button" variant="dangerOutline" size="sm" onClick={() => setOpen(true)} className="w-full sm:w-auto">ยกเลิกคำขอ</Button>
    <ConfirmDialog
      open={open}
      title="ยืนยันการยกเลิกคำขอ"
      description="หากยกเลิกแล้ว คำขอนี้จะไม่ถูกส่งให้ผู้ใหญ่บ้านตรวจสอบ"
      confirmLabel="ยกเลิกคำขอ"
      cancelLabel="กลับ"
      tone="danger"
      pending={pending}
      onClose={() => !pending && setOpen(false)}
      onConfirm={() => startTransition(async () => {
        try {
          await cancelBindingRequestAction();
          setOpen(false);
          toast.success("ยกเลิกคำขอแล้ว", "คุณสามารถส่งคำขอผูกบ้านใหม่ได้เมื่อพร้อม");
          router.refresh();
        } catch {
          toast.error("ยกเลิกคำขอไม่สำเร็จ", "กรุณาลองใหม่อีกครั้ง");
        }
      })}
    />
  </>;
}
