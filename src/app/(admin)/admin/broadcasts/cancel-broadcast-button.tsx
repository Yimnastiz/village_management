"use client";

import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";

export function CancelBroadcastButton({ action, broadcastId }: { action: (formData: FormData) => void | Promise<void>; broadcastId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  return <>
    <form ref={formRef} action={action}>
      <input type="hidden" name="broadcastGroupId" value={broadcastId} />
      <Button type="button" variant="dangerOutline" onClick={() => setOpen(true)}>ยกเลิกประกาศ</Button>
    </form>
    <ConfirmDialog open={open} title="ยกเลิกประกาศนี้?" description="เมื่อยกเลิก ประกาศจะหยุดแสดงและการแจ้งเตือนที่ยังใช้งานอยู่จะถูกจัดเก็บ" confirmLabel="ยกเลิกประกาศ" tone="danger" onClose={() => setOpen(false)} onConfirm={() => formRef.current?.requestSubmit()} />
  </>;
}
