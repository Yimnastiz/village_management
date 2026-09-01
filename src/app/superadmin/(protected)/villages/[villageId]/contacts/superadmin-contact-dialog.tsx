"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { SuperAdminContactForm, type SuperAdminContact } from "./superadmin-contact-form";

export function SuperAdminContactDialog({ villageId, initial }: { villageId: string; initial?: SuperAdminContact }) {
  const [open, setOpen] = useState(false); const [dirty, setDirty] = useState(false); const [submitting, setSubmitting] = useState(false); const [discard, setDiscard] = useState(false); const formId = `superadmin-contact-${initial?.id ?? "new"}`;
  const close = () => { if (submitting) return; if (dirty) { setDiscard(true); return; } setOpen(false); };
  return <><Button type="button" size="sm" variant={initial ? "outline" : "primary"} className={initial ? undefined : "h-10 px-2 sm:px-3"} onClick={() => setOpen(true)}>{initial ? <><Pencil className="mr-1 h-4 w-4" />แก้ไข</> : <><Plus className="mr-1 h-4 w-4" />เพิ่มผู้ติดต่อ</>}</Button><Dialog open={open} title={initial ? "แก้ไขผู้ติดต่อ" : "เพิ่มผู้ติดต่อ"} description={initial ? "อัปเดตข้อมูลการติดต่อของหมู่บ้าน" : "เพิ่มข้อมูลการติดต่อของหมู่บ้าน"} onClose={close} closeOnBackdrop={false} className="sm:max-w-xl" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={close} disabled={submitting}>ยกเลิก</Button><Button type="submit" form={formId} isLoading={submitting} disabled={submitting}>{initial ? "บันทึกการแก้ไข" : "เพิ่มผู้ติดต่อ"}</Button></div>}><SuperAdminContactForm key={open ? "open" : "closed"} villageId={villageId} initial={initial} formId={formId} onSuccess={() => { setDirty(false); setOpen(false); }} onDirtyChange={setDirty} onSubmittingChange={setSubmitting} /></Dialog><ConfirmDialog open={discard} title={initial ? "ยกเลิกการแก้ไข?" : "ยกเลิกการเพิ่มผู้ติดต่อ?"} description="ข้อมูลที่กรอกไว้จะไม่ถูกบันทึก" confirmLabel="ยกเลิกการกรอก" pending={false} onClose={() => setDiscard(false)} onConfirm={() => { setDiscard(false); setDirty(false); setOpen(false); }} /></>;
}
