"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { deleteIssueAction, addIssueMessageAction } from "../actions";

export function DeleteIssueButton({ issueId }: { issueId: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { pushToast } = useToast();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteIssueAction(issueId, reason);
      if (!result.success) {
        pushToast({ tone: "error", title: "ลบคำร้องไม่สำเร็จ", description: result.error });
        setIsDeleting(false);
        return;
      }
      pushToast({ tone: "success", title: "ลบคำร้องเรียบร้อยแล้ว" });
      router.push("/resident/issues");
    } catch {
      pushToast({ tone: "error", title: "ลบคำร้องไม่สำเร็จ", description: "กรุณาลองใหม่อีกครั้ง" });
      setIsDeleting(false);
    }
  };

  return (
    <div>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4 mr-1" />
        ลบคำร้อง
      </Button>
      <ConfirmDialog
        open={open}
        title="ลบคำร้อง"
        description="กรุณาระบุเหตุผลก่อนลบคำร้อง การดำเนินการนี้ไม่สามารถย้อนกลับได้"
        confirmLabel="ลบคำร้อง"
        cancelLabel="ยกเลิก"
        tone="danger"
        pending={isDeleting}
        confirmDisabled={reason.trim().length < 5 || reason.trim().length > 500}
        onClose={() => { if (!isDeleting) { setOpen(false); setReason(""); } }}
        onConfirm={handleDelete}
      >
        <Textarea
          label="เหตุผลในการลบ"
          required
          minLength={5}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          error={reason.length > 0 && (reason.trim().length < 5 || reason.trim().length > 500) ? "กรุณาระบุ 5–500 ตัวอักษร" : undefined}
          helperText={`${reason.trim().length}/500 ตัวอักษร`}
          rows={4}
          autoFocus
        />
      </ConfirmDialog>
    </div>
  );
}

export function MessageForm({ issueId }: { issueId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setIsSubmitting(true);
    setError(null);
    const result = await addIssueMessageAction(issueId, message);
    if (!result.success) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }
    setMessage("");
    setIsSubmitting(false);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        label="เพิ่มข้อความ/ความคิดเห็น"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="พิมพ์ข้อความถึงผู้ดูแล..."
        rows={3}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button type="submit" size="sm" isLoading={isSubmitting}>
        <MessageSquare className="h-4 w-4 mr-1" />
        ส่งข้อความ
      </Button>
    </form>
  );
}
