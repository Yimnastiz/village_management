"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteDownloadAction } from "../actions";

export function DownloadDeleteButton({ fileId }: { fileId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    if (!confirm("ต้องการลบเอกสารนี้ใช่หรือไม่?")) return;

    setIsSubmitting(true);
    setError(null);
    const result = await deleteDownloadAction(fileId);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.push("/admin/downloads");
    router.refresh();
  };

  return (
    <div className="space-y-2">
      <Button variant="danger" onClick={onDelete} isLoading={isSubmitting}>
        ลบเอกสาร
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
