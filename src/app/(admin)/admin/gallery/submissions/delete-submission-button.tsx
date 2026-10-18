"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { adminDeleteGalleryItemSubmissionAction } from "../actions";

export function DeleteGallerySubmissionButton({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onDelete = async (reason: string) => {
    setIsSubmitting(true);
    const result = await adminDeleteGalleryItemSubmissionAction(submissionId, reason);
    setIsSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("ลบรูปภาพเรียบร้อยแล้ว");
    setOpen(false);
    router.replace("/admin/gallery/submissions");
  };

  return <>
    <Button type="button" variant="dangerOutline" onClick={() => setOpen(true)} disabled={isSubmitting}>ลบรูปภาพ</Button>
    <ActionReasonDialog
      open={open}
      action="content.delete"
      title="ลบรูปภาพ"
      description="รูปภาพนี้จะถูกนำออกจากระบบ กรุณาระบุเหตุผลในการดำเนินการ"
      submitLabel="ลบรูปภาพ"
      loading={isSubmitting}
      onCancel={() => setOpen(false)}
      onSubmit={onDelete}
    />
  </>;
}
