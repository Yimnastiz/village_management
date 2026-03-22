"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteGalleryAlbumAction } from "../actions";

export function DeleteAlbumButton({ albumId }: { albumId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    if (!confirm("ต้องการลบอัลบั้มนี้ใช่หรือไม่? (รูปภาพภายในจะถูกลบทั้งหมด)")) return;

    setIsSubmitting(true);
    setError(null);
    const result = await deleteGalleryAlbumAction(albumId);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.push("/admin/gallery");
    router.refresh();
  };

  return (
    <div className="space-y-2">
      <Button variant="danger" onClick={onDelete} isLoading={isSubmitting}>
        ลบอัลบั้ม
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
