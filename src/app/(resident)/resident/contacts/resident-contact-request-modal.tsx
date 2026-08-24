"use client";

import { FilePlus2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { ContactRequestForm } from "./contact-request-form";

type ResidentContactRequestModalProps = {
  defaultOpen?: boolean;
  fullLabel?: boolean;
};

export function ResidentContactRequestModal({ defaultOpen = false, fullLabel = false }: ResidentContactRequestModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [open, setOpen] = useState(defaultOpen);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const close = () => {
    if (isSubmitting) return;
    setOpen(false);
    if (defaultOpen) router.replace(pathname);
  };

  return <>
    <Button type="button" size="sm" className="h-10 px-2 sm:px-3" onClick={() => setOpen(true)}>
      <FilePlus2 className="h-4 w-4" /><span className={fullLabel ? "ml-1" : "hidden min-[390px]:ml-1 min-[390px]:inline"}>{fullLabel ? "ส่งคำขอใหม่" : "ขอเพิ่มผู้ติดต่อ"}</span>
    </Button>
    <Dialog open={open} onClose={close} closeOnBackdrop={false} title="ส่งคำขอเพิ่มผู้ติดต่อ" description="ข้อมูลจะถูกส่งให้ผู้ดูแลหมู่บ้านตรวจสอบก่อนเผยแพร่" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={isSubmitting} onClick={close}>ยกเลิก</Button><Button type="submit" form="resident-contact-request-modal-form" isLoading={isSubmitting} disabled={isSubmitting}>ส่งคำขอ</Button></div>}>
      <ContactRequestForm formId="resident-contact-request-modal-form" onSuccess={() => { setOpen(false); if (defaultOpen) router.replace(pathname); toast.success("ส่งคำขอผู้ติดต่อเรียบร้อยแล้ว", "รอผู้ดูแลหมู่บ้านตรวจสอบและอนุมัติ"); router.refresh(); }} onSubmittingChange={setIsSubmitting} />
    </Dialog>
  </>;
}
