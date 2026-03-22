"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteTransparencyAction } from "../actions";

export function DeleteTransparencyButton({ transparencyId }: { transparencyId: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirm("ยืนยันการลบรายการนี้? การลบจะไม่สามารถย้อนกลับได้")) return;

    setIsDeleting(true);
    setError(null);

    const result = await deleteTransparencyAction(transparencyId);
    if (!result.success) {
      setError(result.error);
      setIsDeleting(false);
      return;
    }

    router.push("/admin/transparency");
    router.refresh();
  };

  return (
    <div>
      <Button size="sm" variant="danger" onClick={handleDelete} isLoading={isDeleting}>
        <Trash2 className="h-4 w-4 mr-1" /> ลบรายการ
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
