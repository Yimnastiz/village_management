"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { deletePendingNewsSubmissionAction } from "../actions";
import { requestEditHref, requestListHref, type ResidentNewsContext } from "@/lib/resident-news-navigation";

type ResidentNewsRequestActionsProps = {
  requestId: string;
  editable: boolean;
  deletable: boolean;
  context: ResidentNewsContext | null;
};

export function ResidentNewsRequestActions({ requestId, editable, deletable, context }: ResidentNewsRequestActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const { pushToast } = useToast();

  const removeRequest = async () => {
    if (pending) return;
    setPending(true);
    try {
      const result = await deletePendingNewsSubmissionAction(requestId);
      if (!result.success) {
        pushToast({ tone: "error", title: "ลบคำขอไม่สำเร็จ", description: result.error });
        return;
      }

      pushToast({ tone: "success", title: "ลบคำขอเรียบร้อยแล้ว" });
      router.push(requestListHref(context));
    } catch (error) {
      pushToast({
        tone: "error",
        title: "ลบคำขอไม่สำเร็จ",
        description: error instanceof Error ? error.message : "กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setPending(false);
    }
  };

  if (!editable && !deletable) return null;

  return (
    <div className="flex flex-wrap justify-end gap-2" aria-label="การดำเนินการคำขอ">
      {editable ? (
        <Link href={requestEditHref(requestId, context)}>
          <Button variant="outline"><Pencil className="mr-1.5 h-4 w-4" />แก้ไขคำขอ</Button>
        </Link>
      ) : null}
      {deletable ? (
        <Button type="button" variant="danger" onClick={() => setConfirmOpen(true)} disabled={pending}>
          <Trash2 className="mr-1.5 h-4 w-4" />ลบคำขอ
        </Button>
      ) : null}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => { if (!pending) setConfirmOpen(false); }}
        onConfirm={() => { void removeRequest(); }}
        pending={pending}
        tone="danger"
        title="ลบคำขอข่าว"
        description="คุณต้องการลบคำขอนี้หรือไม่ การดำเนินการนี้ไม่สามารถย้อนกลับได้"
        confirmLabel="ลบคำขอ"
      />
    </div>
  );
}
