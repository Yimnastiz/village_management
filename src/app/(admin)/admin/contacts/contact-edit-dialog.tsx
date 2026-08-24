"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { ContactForm } from "./contact-form";

type ContactDefaults = {
  name: string;
  role: string;
  phone: string;
  email: string;
  address: string;
  category: string;
  isPublic: boolean;
};

export function ContactEditDialog({
  contactId,
  defaultValues,
  residentRequested,
}: {
  contactId: string;
  defaultValues: ContactDefaults;
  residentRequested: boolean;
}) {
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
  const formId = `contact-edit-${contactId}`;
  const scopedToVisibility = residentRequested;

  return <>
    <Button type="button" variant="outline" onClick={() => setOpen(true)}>
      {scopedToVisibility ? "ตั้งค่าการแสดงผล" : "แก้ไขข้อมูล"}
    </Button>
    <Dialog
      open={open}
      title={scopedToVisibility ? "ตั้งค่าผู้ติดต่อ" : "แก้ไขข้อมูลผู้ติดต่อ"}
      description={scopedToVisibility ? "จัดการการแสดงผลข้อมูลผู้ติดต่อ" : "อัปเดตข้อมูลผู้ติดต่อของหมู่บ้าน"}
      onClose={close}
      closeOnBackdrop={false}
      className="sm:max-w-xl"
      footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={close} disabled={submitting}>ยกเลิก</Button><Button type="submit" form={formId} isLoading={submitting} disabled={submitting}>บันทึกการแก้ไข</Button></div>}
    >
      <ContactForm mode="edit" editScope={scopedToVisibility ? "visibility" : "full"} contactId={contactId} defaultValues={defaultValues} formId={formId} compact hideActions onSuccess={closeAfterSuccess} onDirtyChange={setDirty} onSubmittingChange={setSubmitting} />
    </Dialog>
    <ConfirmDialog open={confirmDiscard} title="ยกเลิกการแก้ไข?" description="ข้อมูลที่แก้ไขไว้จะไม่ถูกบันทึก" confirmLabel="ยกเลิกการแก้ไข" pending={false} onClose={() => setConfirmDiscard(false)} onConfirm={() => { setConfirmDiscard(false); setDirty(false); setOpen(false); }} />
  </>;
}
