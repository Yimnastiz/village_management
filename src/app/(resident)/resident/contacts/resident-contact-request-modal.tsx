"use client";

import { FilePenLine, FilePlus2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { createResidentContactUpdateRequestAction, updateResidentContactRequestAction } from "./actions";
import { ContactRequestForm, type ContactRequestFormValues } from "./contact-request-form";

type Mode = "create" | "edit-request" | "update-contact";
type Props = {
  mode?: Mode;
  requestId?: string;
  contactId?: string;
  initialValues?: ContactRequestFormValues;
  defaultOpen?: boolean;
  fullLabel?: boolean;
  buttonLabel?: string;
  buttonVariant?: "primary" | "outline";
};

export function ResidentContactRequestModal({ mode = "create", requestId, contactId, initialValues, defaultOpen = false, fullLabel = false, buttonLabel, buttonVariant = "primary" }: Props) {
  const router = useRouter(); const pathname = usePathname();
  const [open, setOpen] = useState(defaultOpen); const [isSubmitting, setIsSubmitting] = useState(false);
  const isUpdate = mode === "update-contact"; const isEdit = mode === "edit-request";
  const label = buttonLabel ?? (isUpdate ? "ขอแก้ไขข้อมูล" : isEdit ? "แก้ไขคำขอ" : fullLabel ? "ส่งคำขอใหม่" : "ขอเพิ่มผู้ติดต่อ");
  const title = isUpdate ? "ขอแก้ไขข้อมูลผู้ติดต่อ" : isEdit ? "แก้ไขคำขอผู้ติดต่อ" : "ส่งคำขอเพิ่มผู้ติดต่อ";
  const primary = isUpdate ? "ส่งคำขอแก้ไข" : isEdit ? "บันทึกการแก้ไข" : "ส่งคำขอ";
  const formId = `resident-contact-request-${mode}-${requestId ?? contactId ?? "new"}`;
  const close = () => { if (isSubmitting) return; setOpen(false); if (defaultOpen) router.replace(pathname); };
  const submitAction = isEdit && requestId ? (formData: FormData) => updateResidentContactRequestAction(requestId, formData) : isUpdate && contactId ? (formData: FormData) => createResidentContactUpdateRequestAction(contactId, formData) : undefined;

  return <>
    <Button type="button" variant={buttonVariant} size="sm" className={fullLabel || buttonLabel ? "h-10 px-3" : "h-10 px-2 sm:px-3"} onClick={() => setOpen(true)}>
      {isUpdate || isEdit ? <FilePenLine className="h-4 w-4" /> : <FilePlus2 className="h-4 w-4" />}<span className={fullLabel || buttonLabel ? "ml-1" : "hidden min-[390px]:ml-1 min-[390px]:inline"}>{label}</span>
    </Button>
    <Dialog open={open} onClose={close} closeOnBackdrop={false} title={title} description={isUpdate ? "ข้อมูลที่เสนอจะแสดงหลังผู้ดูแลหมู่บ้านอนุมัติเท่านั้น" : "ข้อมูลจะถูกส่งให้ผู้ดูแลหมู่บ้านตรวจสอบก่อนเผยแพร่"} footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={isSubmitting} onClick={close}>ยกเลิก</Button><Button type="submit" form={formId} isLoading={isSubmitting} disabled={isSubmitting}>{primary}</Button></div>}>
      <ContactRequestForm formId={formId} initialValues={initialValues} submitAction={submitAction} successToastTitle={isEdit ? "แก้ไขคำขอเรียบร้อยแล้ว" : isUpdate ? "ส่งคำขอแก้ไขผู้ติดต่อเรียบร้อยแล้ว" : "ส่งคำขอผู้ติดต่อเรียบร้อยแล้ว"} failureToastTitle={isEdit ? "แก้ไขคำขอไม่สำเร็จ" : isUpdate ? "ส่งคำขอแก้ไขผู้ติดต่อไม่สำเร็จ" : "ส่งคำขอผู้ติดต่อไม่สำเร็จ"} onSuccess={() => { setOpen(false); if (defaultOpen) router.replace(pathname); router.refresh(); }} onSubmittingChange={setIsSubmitting} />
    </Dialog>
  </>;
}
