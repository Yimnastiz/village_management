"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { adminDeleteVillagePlaceAction } from "./actions";

export function DeletePlaceButton({ placeId }: { placeId: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    const ok = window.confirm("ยืนยันการลบสถานที่นี้?");
    if (!ok) return;

    setIsLoading(true);
    setError(null);

    const result = await adminDeleteVillagePlaceAction(placeId);

    setIsLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }

    router.push("/admin/places");
    router.refresh();
  };

  return (
    <div className="space-y-2">
      <Button variant="danger" onClick={onDelete} isLoading={isLoading}>ลบสถานที่</Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
