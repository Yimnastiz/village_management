"use client";

import { FilePlus2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CalendarRequestForm } from "./requests/request-form";

export function ResidentEventRequestModal() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formId = "resident-calendar-event-request";
  return <>
    <Button type="button" size="sm" className="h-10 px-2 sm:px-3" onClick={() => setOpen(true)}><FilePlus2 className="h-4 w-4" /><span className="ml-1 hidden min-[390px]:inline">ขอเพิ่มกิจกรรม</span></Button>
    <Dialog open={open} onClose={() => { if (!isSubmitting) setOpen(false); }} closeOnBackdrop={false} closeOnEscape={false} title="ขอเพิ่มกิจกรรม" description="คำขอจะถูกส่งให้ผู้ใหญ่บ้านตรวจสอบก่อนเผยแพร่" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>ยกเลิก</Button><Button type="submit" form={formId} isLoading={isSubmitting} disabled={isSubmitting}>ส่งคำขอกิจกรรม</Button></div>}>
      <CalendarRequestForm embedded formId={formId} hideActions onSubmittingChange={setIsSubmitting} onSuccess={() => { setIsSubmitting(false); setOpen(false); }} />
    </Dialog>
  </>;
}
