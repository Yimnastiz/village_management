"use client";

import { useState } from "react";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { ContactForm } from "./contact-form";

export function ContactCreateDialog({ compact = false, className }: { compact?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const close = () => {
    if (submitting) return;
    if (dirty) { setConfirmDiscard(true); return; }
    setOpen(false);
  };
  const closeAfterSuccess = () => { setDirty(false); setOpen(false); };

  return <>
    <Button type="button" size="sm" className={className ?? "h-10 px-2 sm:px-3"} onClick={() => setOpen(true)}>
      <FilePlus2 className="h-4 w-4" /><span className={compact ? "hidden min-[390px]:ml-1.5 min-[390px]:inline" : "ml-1.5"}>เพิ่มผู้ติดต่อ</span>
    </Button>
    <Dialog open={open} title="เพิ่มผู้ติดต่อ" description="บันทึกข้อมูลผู้ติดต่อของหมู่บ้าน" onClose={close} closeOnBackdrop={false} className="sm:max-w-xl" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={close} disabled={submitting}>ยกเลิก</Button><Button type="submit" form="contact-create-form" isLoading={submitting} disabled={submitting}>เพิ่มผู้ติดต่อ</Button></div>}>
      <ContactForm mode="create" formId="contact-create-form" compact hideActions onSuccess={closeAfterSuccess} onDirtyChange={setDirty} onSubmittingChange={setSubmitting} />
    </Dialog>
    <ConfirmDialog open={confirmDiscard} title="ยกเลิกการเพิ่มผู้ติดต่อ?" description="ข้อมูลที่กรอกไว้จะไม่ถูกบันทึก" confirmLabel="ยกเลิกการกรอก" pending={false} onClose={() => setConfirmDiscard(false)} onConfirm={() => { setConfirmDiscard(false); setDirty(false); setOpen(false); }} />
  </>;
}
