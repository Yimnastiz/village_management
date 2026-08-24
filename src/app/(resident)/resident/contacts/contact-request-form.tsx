"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { CONTACT_CATEGORY_OPTIONS, CONTACT_PHONE_MAX_LENGTH, normalizeContactPhone, validateContactPhone } from "@/lib/contact";
import { createResidentContactRequestAction } from "./actions";

type ContactRequestFormProps = {
  formId?: string;
  onSuccess: (requestId: string) => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
};

export function ContactRequestForm({ formId = "resident-contact-request-form", onSuccess, onSubmittingChange }: ContactRequestFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const toast = useToast();

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const nextErrors: Record<string, string> = {};
    if (name.length < 2) nextErrors.name = "กรุณาระบุชื่อผู้ติดต่ออย่างน้อย 2 ตัวอักษร";
    const phoneError = validateContactPhone(phone);
    if (phoneError) nextErrors.phone = phoneError;
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      submittingRef.current = false;
      return;
    }
    setErrors({});
    setIsSubmitting(true);
    onSubmittingChange?.(true);
    try {
      const result = await createResidentContactRequestAction(formData);
      if (!result.success) {
        if (result.field) {
          setErrors({ [result.field]: result.error });
          return;
        }
        toast.error("ส่งคำขอผู้ติดต่อไม่สำเร็จ", result.error);
        return;
      }
      event.currentTarget.reset();
      onSuccess(result.requestId);
    } catch {
      const message = "ไม่สามารถส่งคำขอได้ กรุณาลองใหม่อีกครั้ง";
      toast.error("ส่งคำขอผู้ติดต่อไม่สำเร็จ", message);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
      onSubmittingChange?.(false);
    }
  };

  return <form id={formId} className="space-y-4" onSubmit={submit} noValidate>
    <Input name="name" label="ชื่อผู้ติดต่อ" required minLength={2} error={errors.name} onChange={() => setErrors((current) => ({ ...current, name: "" }))} />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Input name="phone" type="tel" label="เบอร์โทร" required inputMode="numeric" autoComplete="tel" maxLength={CONTACT_PHONE_MAX_LENGTH} pattern="[0-9]*" helperText="ตัวเลข 3–10 หลัก" error={errors.phone} onChange={(event) => { event.currentTarget.value = normalizeContactPhone(event.currentTarget.value); setErrors((current) => ({ ...current, phone: "" })); }} />
      <Input name="role" label="ตำแหน่ง/บทบาท" />
    </div>
    <Select name="category" label="หมวดหมู่" placeholder="เลือกหมวดหมู่ (ไม่ระบุได้)" options={CONTACT_CATEGORY_OPTIONS} error={errors.category} onChange={() => setErrors((current) => ({ ...current, category: "" }))} />
    <Input name="address" label="ที่อยู่/รายละเอียดสถานที่" />
    <Textarea name="note" label="หมายเหตุเพิ่มเติม" rows={4} />
  </form>;
}
