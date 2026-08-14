"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { deleteGalleryItemAction } from "../actions";

export function DeleteGalleryItemButton({ albumId, itemId }: { albumId: string; itemId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const toast = useToast();

  const onDelete = async () => {
    setIsSubmitting(true);
    const result = await deleteGalleryItemAction(albumId, itemId);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("ลบรูปภาพเรียบร้อยแล้ว"); setOpen(false); router.refresh();
  };

  return (
    <><Button variant="outline" size="sm" onClick={() => setOpen(true)} isLoading={isSubmitting}>ลบ</Button><ConfirmDialog open={open} title="ลบรูปภาพ" description="ต้องการลบรูปภาพนี้ใช่หรือไม่?" confirmLabel="ลบรูปภาพ" tone="danger" pending={isSubmitting} onClose={() => setOpen(false)} onConfirm={onDelete} /></>
  );
}
