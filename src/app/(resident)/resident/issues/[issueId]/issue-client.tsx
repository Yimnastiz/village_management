"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { deleteIssueAction, addIssueMessageAction } from "../actions";

export function DeleteIssueButton({ issueId }: { issueId: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirm("ยืนยันการลบคำร้องนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้")) return;
    setIsDeleting(true);
    setError(null);
    const result = await deleteIssueAction(issueId);
    if (!result.success) {
      setError(result.error);
      setIsDeleting(false);
      return;
    }
    router.push("/resident/issues");
  };

  return (
    <div>
      <Button variant="danger" size="sm" onClick={handleDelete} isLoading={isDeleting}>
        <Trash2 className="h-4 w-4 mr-1" />
        ลบคำร้อง
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
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
