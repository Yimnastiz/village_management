"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { adminDeleteNewsSubmissionAction } from "../actions";

export function NewsRequestDeleteButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteRequest = async (reason: string) => {
    setIsDeleting(true);
    try {
      const result = await adminDeleteNewsSubmissionAction(requestId, reason);
      if (!result.success) { toast.error(result.error); return; }
      setOpen(false);
      toast.success("ลบคำขอข่าวเรียบร้อยแล้ว");
      router.push("/admin/news/requests");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ลบคำขอข่าวไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsDeleting(false);
    }
  };

  return <section className="border-t border-gray-100 pt-4">
    <Button type="button" variant="dangerOutline" size="sm" onClick={() => setOpen(true)} disabled={isDeleting}>
      <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />ลบคำขอ
    </Button>
    <ActionReasonDialog
      open={open}
      action="content.delete"
      title="ลบคำขอข่าว"
      description="คำขอนี้จะถูกลบออกจากรายการ กรุณาระบุเหตุผลในการดำเนินการ"
      submitLabel="ยืนยันลบคำขอ"
      loading={isDeleting}
      onCancel={() => setOpen(false)}
      onSubmit={deleteRequest}
    />
  </section>;
}
