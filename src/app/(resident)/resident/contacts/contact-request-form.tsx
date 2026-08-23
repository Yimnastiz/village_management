"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { createResidentContactRequestAction } from "./actions";

type ContactRequestFormProps = {
  formId?: string;
  onSuccess: (requestId: string) => void;
  onCancel?: () => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
  showActions?: boolean;
};

export function ContactRequestForm({ formId = "resident-contact-request-form", onSuccess, onCancel, onSubmittingChange, showActions = false }: ContactRequestFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const toast = useToast();

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setIsSubmitting(true);
    onSubmittingChange?.(true);
    try {
      const result = await createResidentContactRequestAction(new FormData(event.currentTarget));
      if (!result.success) {
        setError(result.error);
        toast.error("ส่งคำขอผู้ติดต่อไม่สำเร็จ", result.error);
        return;
      }
      onSuccess(result.requestId);
    } catch {
      const message = "ไม่สามารถส่งคำขอได้ กรุณาลองใหม่อีกครั้ง";
      setError(message);
      toast.error("ส่งคำขอผู้ติดต่อไม่สำเร็จ", message);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
      onSubmittingChange?.(false);
    }
  };

  return <form id={formId} className="space-y-4" onSubmit={submit}>
    <Input name="name" label="ชื่อผู้ติดต่อ" required minLength={2} />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Input name="phone" label="เบอร์โทร" required />
      <Input name="role" label="ตำแหน่ง/บทบาท" />
    </div>
    <Input name="category" label="หมวดหมู่" placeholder="เช่น ฉุกเฉิน, หน่วยงาน" />
    <Input name="address" label="ที่อยู่/รายละเอียดสถานที่" />
    <Textarea name="note" label="หมายเหตุเพิ่มเติม" rows={4} />
    {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
    {showActions ? <div className="flex flex-col-reverse gap-2 sm:flex-row"><Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>ยกเลิก</Button><Button type="submit" isLoading={isSubmitting}>ส่งคำขอ</Button></div> : null}
  </form>;
}
