"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cancelBindingRequestAction } from "./actions";

export function CancelBindingButton() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return <>
    <button type="button" onClick={() => setOpen(true)} className="w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">ยกเลิกคำขอ</button>
    <ConfirmDialog
      open={open}
      title="ยกเลิกคำขอผูกเลขบ้าน?"
      description="คำขอจะถูกเก็บในประวัติด้วยสถานะยกเลิก และคุณสามารถเลือกหมู่บ้านหรือบ้านเลขที่ใหม่ได้"
      confirmLabel="ยืนยันยกเลิกคำขอ"
      tone="danger"
      pending={pending}
      onClose={() => setOpen(false)}
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
