"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { deleteContactAction } from "../actions";

export function DeleteContactButton({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const onDelete = async (reason: string) => {
    setIsSubmitting(true);
    setError(null);
    const result = await deleteContactAction(contactId, reason);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.push("/admin/contacts");
    router.refresh();
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <Button variant="danger" onClick={() => setOpen(true)} isLoading={isSubmitting}>
        ลบผู้ติดต่อ
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ActionReasonDialog open={open} action="content.delete" title="ลบผู้ติดต่อ" description="รายการผู้ติดต่อจะถูกลบและบันทึกเหตุผลใน Audit Log" submitLabel="ยืนยันการลบ" loading={isSubmitting} onCancel={() => setOpen(false)} onSubmit={onDelete} />
    </div>
  );
}
