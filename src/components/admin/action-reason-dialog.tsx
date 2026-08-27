"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getActionPolicy, type SensitiveAction } from "@/lib/sensitive-action-policy";

type ActionReasonDialogProps = {
  open: boolean;
  action: SensitiveAction;
  title: string;
  description: string;
  submitLabel?: string;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void | Promise<void>;
};

/** Shared /admin reason interaction for sensitive actions. */
export function ActionReasonDialog({ open, action, title, description, submitLabel = "ยืนยัน", loading = false, onCancel, onSubmit }: ActionReasonDialogProps) {
  const policy = getActionPolicy(action);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const normalizedReason = reason.trim();
  const busy = loading || submitting;
  const valid = !policy.requiresReason || normalizedReason.length >= policy.minReasonLength;

  const submit = async () => {
    if (!valid || busy || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try { await onSubmit(normalizedReason); setReason(""); } finally { submittingRef.current = false; setSubmitting(false); }
  };
  const cancel = () => { if (!busy) { setReason(""); onCancel(); } };

  return (
    <Dialog open={open} title={title} description={description} onClose={cancel} closeOnBackdrop={false} closeOnEscape={!busy} footer={
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={busy} onClick={cancel}>ยกเลิก</Button>
        <Button type="button" isLoading={busy} disabled={!valid || busy} onClick={() => void submit()}>{submitLabel}</Button>
      </div>
    }>
      <Textarea autoFocus label="เหตุผล" required value={reason} onChange={(event) => setReason(event.target.value)} helperText={`อย่างน้อย ${policy.minReasonLength} ตัวอักษร`} disabled={busy} />
    </Dialog>
  );
}
