"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { CONTACT_CATEGORY_OPTIONS, CONTACT_PHONE_MAX_LENGTH, isContactCategory, normalizeContactPhone, validateContactEmail, validateContactPhone } from "@/lib/contact";
import { createResidentContactRequestAction, type ContactRequestResult } from "./actions";

export type ContactRequestFormValues = { name: string; role?: string | null; phone: string; email?: string | null; address?: string | null; category?: string | null; note?: string | null };

type ContactRequestFormProps = {
  formId: string;
  initialValues?: ContactRequestFormValues;
  submitAction?: (formData: FormData) => Promise<ContactRequestResult>;
  onSuccess: (requestId: string) => void;
  successToastTitle?: string;
  failureToastTitle?: string;
  onSubmittingChange?: (isSubmitting: boolean) => void;
};

export function ContactRequestForm({ formId, initialValues, submitAction = createResidentContactRequestAction, onSuccess, successToastTitle = "ส่งคำขอผู้ติดต่อเรียบร้อยแล้ว", failureToastTitle = "ส่งคำขอผู้ติดต่อไม่สำเร็จ", onSubmittingChange }: ContactRequestFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const toast = useToast();
  const categoryOptions = initialValues?.category && !isContactCategory(initialValues.category)
    ? [{ value: initialValues.category, label: `${initialValues.category} (หมวดหมู่เดิม)` }, ...CONTACT_CATEGORY_OPTIONS]
    : CONTACT_CATEGORY_OPTIONS;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const nextErrors: Record<string, string> = {};
    if (name.length < 2) nextErrors.name = "กรุณาระบุชื่อผู้ติดต่ออย่างน้อย 2 ตัวอักษร";
    const phoneError = validateContactPhone(phone);
    if (phoneError) nextErrors.phone = phoneError;
    const emailError = validateContactEmail(email);
    if (emailError) nextErrors.email = emailError;
    if (!category) nextErrors.category = "กรุณาเลือกหมวดหมู่";
    else if (!isContactCategory(category) && category !== initialValues?.category) nextErrors.category = "หมวดหมู่ผู้ติดต่อไม่ถูกต้อง";
    if (Object.keys(nextErrors).length > 0) { setErrors(nextErrors); submittingRef.current = false; return; }

    try {
      setErrors({}); setIsSubmitting(true); onSubmittingChange?.(true);
      let result: ContactRequestResult;
      try {
        result = await submitAction(formData);
      } catch {
        toast.error(failureToastTitle, "ไม่สามารถส่งคำขอได้ กรุณาลองใหม่อีกครั้ง");
        return;
      }
      if (!result.success) {
        if (result.field) { setErrors({ [result.field]: result.error }); return; }
        toast.error(failureToastTitle, result.error); return;
      }
      try {
        event.currentTarget.reset();
      } catch (error) {
        console.error("Contact request succeeded but form reset failed", error);
      }
      toast.success(successToastTitle);
      try {
        onSuccess(result.requestId);
      } catch (error) {
        console.error("Contact request succeeded but post-success UI work failed", error);
      }
    } finally {
      submittingRef.current = false; setIsSubmitting(false); onSubmittingChange?.(false);
    }
  };

  return <form id={formId} className="space-y-4" onSubmit={submit} noValidate>
    <Input name="name" label="ชื่อผู้ติดต่อ" required minLength={2} defaultValue={initialValues?.name ?? ""} error={errors.name} onChange={() => setErrors((current) => ({ ...current, name: "" }))} />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Input name="phone" type="tel" label="เบอร์โทร" required inputMode="numeric" autoComplete="tel" maxLength={CONTACT_PHONE_MAX_LENGTH} pattern="[0-9]*" defaultValue={initialValues?.phone ?? ""} helperText="ตัวเลข 3–10 หลัก" error={errors.phone} onChange={(event) => { event.currentTarget.value = normalizeContactPhone(event.currentTarget.value); setErrors((current) => ({ ...current, phone: "" })); }} />
      <Input name="role" label="ตำแหน่ง/บทบาท" defaultValue={initialValues?.role ?? ""} />
    </div>
    <Select name="category" label="หมวดหมู่" required placeholder="เลือกหมวดหมู่" options={categoryOptions} defaultValue={initialValues?.category ?? ""} error={errors.category} onChange={() => setErrors((current) => ({ ...current, category: "" }))} />
    <Input name="email" type="email" label="อีเมล" autoComplete="email" defaultValue={initialValues?.email ?? ""} error={errors.email} onChange={() => setErrors((current) => ({ ...current, email: "" }))} />
    <Input name="address" label="ที่อยู่/รายละเอียดสถานที่" defaultValue={initialValues?.address ?? ""} />
    <Textarea name="note" label="หมายเหตุเพิ่มเติม" rows={4} defaultValue={initialValues?.note ?? ""} />
  </form>;
}
