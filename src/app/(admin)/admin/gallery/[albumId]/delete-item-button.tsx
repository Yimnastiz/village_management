"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { useToast } from "@/components/ui/toast";
import { deleteGalleryItemAction } from "../actions";

export function DeleteGalleryItemButton({ albumId, itemId }: { albumId: string; itemId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const toast = useToast();

  const onDelete = async (reason: string) => {
    setIsSubmitting(true);
    const result = await deleteGalleryItemAction(albumId, itemId, reason);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("ลบรูปภาพเรียบร้อยแล้ว"); setOpen(false); router.refresh();
  };

  return (
    <><Button variant="outline" size="sm" onClick={() => setOpen(true)} isLoading={isSubmitting}>ลบ</Button><ActionReasonDialog open={open} action="content.delete" title="ลบรูปภาพ" description="รูปภาพจะถูกลบและบันทึกเหตุผลใน Audit Log" submitLabel="ลบรูปภาพ" loading={isSubmitting} onCancel={() => setOpen(false)} onSubmit={onDelete} /></>
  );
}
