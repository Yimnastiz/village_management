"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { adminDeleteNewsAction } from "../actions";

export function NewsDeleteButton({ newsId }: { newsId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await adminDeleteNewsAction(newsId);
    if (!result.success) {
      toast.error(result.error);
      setIsDeleting(false);
      return;
    }
    toast.success("ลบข่าวเรียบร้อยแล้ว");
    router.push("/admin/news");
    router.refresh();
  };

  return <><Button variant="danger" size="sm" onClick={() => setOpen(true)}><Trash2 className="mr-1 h-4 w-4" />ลบข่าว</Button><ConfirmDialog open={open} title="ลบข่าว" description="ยืนยันการลบข่าวนี้หรือไม่? การลบไม่สามารถย้อนกลับได้" confirmLabel="ลบข่าว" cancelLabel="ยกเลิก" tone="danger" pending={isDeleting} onClose={() => !isDeleting && setOpen(false)} onConfirm={() => { void handleDelete(); }} /></>;
}
