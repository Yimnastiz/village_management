"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { createNewsDeleteRequestAction } from "./actions";

type NewsDeleteRequestButtonProps = {
  newsId: string;
  className?: string;
};

/** The sole resident entry point for moderated deletion of published News. */
export function NewsDeleteRequestButton({ newsId, className }: NewsDeleteRequestButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const { pushToast } = useToast();
  const valid = reason.trim().length >= 5;

  const close = () => {
    if (pending) return;
    setOpen(false);
  };

  const submit = async () => {
    if (pending || !valid) return;
    setPending(true);
    try {
      const result = await createNewsDeleteRequestAction(newsId, reason);
      if (!result.success) {
        pushToast({ tone: "error", title: "ส่งคำขอลบข่าวไม่สำเร็จ", description: result.error });
        return;
      }
      setOpen(false);
      setReason("");
      pushToast({ tone: "success", title: "ส่งคำขอลบข่าวแล้ว", description: "ผู้ดูแลหมู่บ้านจะตรวจสอบคำขอของคุณ" });
      router.refresh();
    } catch (error) {
      pushToast({ tone: "error", title: "ส่งคำขอลบข่าวไม่สำเร็จ", description: error instanceof Error ? error.message : "กรุณาลองใหม่อีกครั้ง" });
    } finally {
      setPending(false);
    }
  };

  return <>
    <Button type="button" variant="danger" className={className} onClick={() => setOpen(true)} disabled={pending}>
      <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />ขอลบข่าว
    </Button>
    <ConfirmDialog
      open={open}
      onClose={close}
      onConfirm={() => { void submit(); }}
      pending={pending}
      confirmDisabled={!valid}
      tone="danger"
      title="ขอลบข่าว"
      description="คำขอลบจะถูกส่งให้ผู้ดูแลหมู่บ้านตรวจสอบก่อนนำข่าวออกจากระบบ"
      confirmLabel="ส่งคำขอลบ"
    >
      <label htmlFor={`news-delete-reason-${newsId}`} className="block text-sm font-medium text-gray-800">เหตุผล <span className="text-rose-600" aria-hidden="true">*</span></label>
      <textarea id={`news-delete-reason-${newsId}`} value={reason} onChange={(event) => setReason(event.target.value)} disabled={pending} rows={3} className="mt-1.5 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 disabled:bg-gray-50" aria-describedby={`news-delete-reason-help-${newsId}`} />
      <p id={`news-delete-reason-help-${newsId}`} className="mt-1 text-xs text-gray-500">อย่างน้อย 5 ตัวอักษร</p>
    </ConfirmDialog>
  </>;
}
