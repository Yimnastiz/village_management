"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { broadcastAnnouncementAction } from "./actions";

export function BroadcastForm() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [draftData, setDraftData] = useState<FormData | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDraftData(new FormData(event.currentTarget));
    setDialogOpen(true);
  };

  const handleConfirm = async () => {
    if (!draftData) {
      return;
    }

    setPending(true);
    try {
      await broadcastAnnouncementAction(draftData);
      pushToast({ tone: "success", title: "ส่งประกาศทั่วระบบแล้ว", description: "ระบบได้กระจายประกาศไปยังทุกหมู่บ้านและทุกผู้ใช้" });
      router.refresh();
      setDialogOpen(false);
    } catch (error) {
      pushToast({ tone: "error", title: "ส่งประกาศไม่สำเร็จ", description: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" });
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <input
          name="title"
          placeholder="หัวข้อประกาศ"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          required
        />
        <textarea
          name="body"
          placeholder="เนื้อหาประกาศ"
          rows={4}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          required
        />
        <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700 focus:ring-cyan-500">
          ส่งประกาศทั่วระบบ
        </Button>
      </form>
      <ConfirmDialog
        open={dialogOpen}
        title="ยืนยันส่งประกาศทั่วระบบ"
        description="ประกาศนี้จะถูกส่งถึงผู้ใช้ทุกบัญชีและกระจายไปยังทุกหมู่บ้านทันที"
        confirmLabel="ส่งประกาศ"
        tone="danger"
        pending={pending}
        onClose={() => !pending && setDialogOpen(false)}
        onConfirm={() => { void handleConfirm(); }}
      />
    </>
  );
}
