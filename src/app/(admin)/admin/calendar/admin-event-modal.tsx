"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CalendarForm } from "./calendar-form";

const formId = "admin-calendar-create-form";

export function AdminEventModal() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const close = () => { if (!isSubmitting) setOpen(false); };

  return <>
    <Button type="button" size="sm" className="h-10 px-2 sm:px-3" onClick={() => setOpen(true)}>
      <Plus className="h-4 w-4" aria-hidden="true" />
      <span className="ml-1 hidden min-[360px]:inline">เพิ่มกิจกรรม</span>
    </Button>
    <Dialog
      open={open}
      title="เพิ่มกิจกรรม"
      onClose={close}
      closeOnBackdrop={false}
      closeOnEscape={false}
      footer={<div className="flex justify-end"><Button type="submit" form={formId} isLoading={isSubmitting}>เพิ่มกิจกรรม</Button></div>}
    >
      <CalendarForm mode="create" embedded formId={formId} hideActions onSuccess={() => { setIsSubmitting(false); setOpen(false); }} onSubmittingChange={setIsSubmitting} />
    </Dialog>
  </>;
}
