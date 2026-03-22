"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminDeleteNewsAction } from "../actions";

export function NewsDeleteButton({ newsId }: { newsId: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirm("ยืนยันการลบข่าวนี้? การลบจะไม่สามารถย้อนกลับได้")) return;

    setIsDeleting(true);
    setError(null);

    const result = await adminDeleteNewsAction(newsId);
    if (!result.success) {
      setError(result.error);
      setIsDeleting(false);
      return;
    }

    router.push("/admin/news");
    router.refresh();
  };

  return (
    <div>
      <Button variant="danger" size="sm" onClick={handleDelete} isLoading={isDeleting}>
        <Trash2 className="h-4 w-4 mr-1" />
        ลบข่าว
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
