"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteGalleryItemAction } from "../actions";

export function DeleteGalleryItemButton({ albumId, itemId }: { albumId: string; itemId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onDelete = async () => {
    if (!confirm("ต้องการลบรูปภาพนี้ใช่หรือไม่?")) return;

    setIsSubmitting(true);
    const result = await deleteGalleryItemAction(albumId, itemId);
    setIsSubmitting(false);

    if (!result.success) {
      alert(result.error);
      return;
    }

    router.refresh();
  };

  return (
    <Button variant="outline" size="sm" onClick={onDelete} isLoading={isSubmitting}>
      ลบ
    </Button>
  );
}
