"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { deleteVillageEventAction } from "../actions";

export function DeleteVillageEventButton({ eventId, isResidentOwned }: { eventId: string; isResidentOwned: boolean }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const onDelete = async (reason: string) => {
    setIsSubmitting(true);
    setError(null);
    const result = await deleteVillageEventAction(eventId, reason);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.push("/admin/calendar");
    router.refresh();
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <Button variant="danger" onClick={() => setOpen(true)} isLoading={isSubmitting}>
        ลบกิจกรรม
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ActionReasonDialog open={open} action="content.delete" title="ลบกิจกรรม" description={isResidentOwned ? "กิจกรรมจะถูกลบออกจากปฏิทิน เหตุผลจะถูกบันทึก และสมาชิกผู้ส่งคำขอจะได้รับการแจ้งเตือน" : "กิจกรรมจะถูกลบออกจากปฏิทินและบันทึกเหตุผลในการดำเนินการ"} submitLabel="ยืนยันการลบ" loading={isSubmitting} onCancel={() => setOpen(false)} onSubmit={onDelete} />
    </div>
  );
}
