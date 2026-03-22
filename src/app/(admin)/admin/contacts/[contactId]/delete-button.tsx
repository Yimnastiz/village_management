"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteContactAction } from "../actions";

export function DeleteContactButton({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    if (!confirm("ต้องการลบผู้ติดต่อนี้ใช่หรือไม่?")) return;

    setIsSubmitting(true);
    setError(null);
    const result = await deleteContactAction(contactId);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.push("/admin/contacts");
    router.refresh();
  };

  return (
    <div className="space-y-2">
      <Button variant="danger" onClick={onDelete} isLoading={isSubmitting}>
        ลบผู้ติดต่อ
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
