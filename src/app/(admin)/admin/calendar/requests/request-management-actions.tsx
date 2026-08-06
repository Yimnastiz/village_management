"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { deleteVillageEventSubmissionAction } from "../actions";

export function CalendarRequestManagementActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const result = await deleteVillageEventSubmissionAction(requestId);
      if (!result.success) {
        setError(result.error);
        pushToast({ tone: "error", title: "ไม่สามารถลบคำขอได้", description: result.error });
        return;
      }

      setIsDialogOpen(false);
      pushToast({ tone: "success", title: "ลบคำขอเรียบร้อยแล้ว" });
      router.push("/admin/calendar/requests");
    } catch (error) {
      const message = error instanceof Error ? error.message : "กรุณาลองใหม่อีกครั้ง";
      setError(message);
      pushToast({ tone: "error", title: "ไม่สามารถลบคำขอได้", description: message });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Link href={`/admin/calendar/requests/${requestId}/edit`} className="w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto"><Pencil className="mr-1.5 h-4 w-4" />แก้ไข</Button>
        </Link>
        <Button variant="danger" onClick={() => setIsDialogOpen(true)} className="w-full sm:w-auto"><Trash2 className="mr-1.5 h-4 w-4" />ลบ</Button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ConfirmDialog
        open={isDialogOpen}
        title="ลบคำขอกิจกรรมนี้?"
        description="เมื่อลบแล้วจะไม่สามารถกู้คืนได้"
        confirmLabel="ลบคำขอ"
        tone="danger"
        pending={isDeleting}
        onConfirm={onDelete}
        onClose={() => { if (!isDeleting) setIsDialogOpen(false); }}
      />
    </div>
  );
}
