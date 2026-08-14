"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { deleteGalleryAlbumAction } from "../actions";

export function DeleteAlbumButton({ albumId }: { albumId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const toast = useToast();

  const onDelete = async () => {
    setIsSubmitting(true);
    setError(null);
    const result = await deleteGalleryAlbumAction(albumId);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error); toast.error(result.error);
      return;
    }

    toast.success("ลบอัลบั้มเรียบร้อยแล้ว"); router.replace("/admin/gallery");
  };

  return (
    <div className="space-y-2">
      <Button variant="dangerOutline" size="sm" onClick={() => setOpen(true)} isLoading={isSubmitting}>ลบอัลบั้ม</Button>
      <ConfirmDialog open={open} title="ลบอัลบั้ม" description="รูปภาพภายในอัลบั้มจะถูกลบทั้งหมด" confirmLabel="ลบอัลบั้ม" tone="danger" pending={isSubmitting} onClose={() => setOpen(false)} onConfirm={onDelete} />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
