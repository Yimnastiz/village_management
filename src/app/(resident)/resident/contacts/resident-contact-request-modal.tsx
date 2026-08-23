"use client";

import { FilePlus2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { ContactRequestForm } from "./contact-request-form";

export function ResidentContactRequestModal() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return <>
    <Button type="button" size="sm" className="h-10 px-2 sm:px-3" onClick={() => setOpen(true)}>
      <FilePlus2 className="h-4 w-4" /><span className="hidden min-[390px]:ml-1 min-[390px]:inline">ขอเพิ่มผู้ติดต่อ</span>
    </Button>
    <Dialog open={open} onClose={() => { if (!isSubmitting) setOpen(false); }} closeOnBackdrop={false} closeOnEscape={false} title="ส่งคำขอเพิ่มผู้ติดต่อ" description="ข้อมูลจะถูกส่งให้แอดมินตรวจสอบก่อนเผยแพร่" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={isSubmitting} onClick={() => setOpen(false)}>ยกเลิก</Button><Button type="submit" form="resident-contact-request-modal-form" isLoading={isSubmitting} disabled={isSubmitting}>ส่งคำขอ</Button></div>}>
      <ContactRequestForm formId="resident-contact-request-modal-form" onSuccess={() => { setOpen(false); toast.success("ส่งคำขอผู้ติดต่อเรียบร้อยแล้ว", "รอแอดมินตรวจสอบและอนุมัติ"); router.refresh(); }} onSubmittingChange={setIsSubmitting} onCancel={() => setOpen(false)} />
    </Dialog>
  </>;
}
