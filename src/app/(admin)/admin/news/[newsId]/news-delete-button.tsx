"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { useToast } from "@/components/ui/toast";
import { adminDeleteNewsAction } from "../actions";

export function NewsDeleteButton({ newsId }: { newsId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (reason: string) => {
    setIsDeleting(true);
    const result = await adminDeleteNewsAction(newsId, reason);
    if (!result.success) {
      toast.error(result.error);
      setIsDeleting(false);
      return;
    }
    toast.success("ลบข่าวเรียบร้อยแล้ว");
    router.push("/admin/news");
    router.refresh();
  };

  return <><Button variant="danger" size="sm" onClick={() => setOpen(true)}><Trash2 className="mr-1 h-4 w-4" />ลบข่าว</Button><ActionReasonDialog open={open} action="content.delete" title="ลบข่าว" description="ข่าวจะถูกลบถาวรและบันทึกเหตุผลใน Audit Log" submitLabel="ลบข่าว" loading={isDeleting} onCancel={() => setOpen(false)} onSubmit={handleDelete} /></>;
}
