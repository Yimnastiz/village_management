"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteVillageEventAction } from "../actions";

export function DeleteVillageEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    if (!confirm("ต้องการลบกิจกรรมนี้ใช่หรือไม่?")) return;

    setIsSubmitting(true);
    setError(null);
    const result = await deleteVillageEventAction(eventId);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.push("/admin/calendar");
    router.refresh();
  };

  return (
    <div className="space-y-2">
      <Button variant="danger" onClick={onDelete} isLoading={isSubmitting}>
        ลบกิจกรรม
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
