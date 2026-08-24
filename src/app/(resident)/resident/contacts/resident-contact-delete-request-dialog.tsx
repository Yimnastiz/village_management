"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { createResidentContactDeleteRequestAction } from "./actions";

export function ResidentContactDeleteRequestDialog({ contactId }: { contactId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const valid = reason.trim().length >= 5;
  function close() { if (!pending) { setOpen(false); setError(""); } }
  async function submit() {
    if (!valid) { setError("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร"); return; }
    setPending(true);
    const form = new FormData(); form.set("deleteReason", reason.trim());
    let result;
    try {
      result = await createResidentContactDeleteRequestAction(contactId, form);
    } catch {
      toast.error("ส่งคำขอลบผู้ติดต่อไม่สำเร็จ", "ไม่สามารถส่งคำขอได้ กรุณาลองใหม่อีกครั้ง");
      setPending(false);
      return;
    }
    if (!result.success) {
      setError(result.error);
      toast.error("ส่งคำขอลบผู้ติดต่อไม่สำเร็จ", result.error);
      setPending(false);
      return;
    }
    toast.success("ส่งคำขอลบผู้ติดต่อเรียบร้อยแล้ว");
    setOpen(false); setPending(false);
    try { router.push(`/resident/contacts/requests/${result.requestId}`); router.refresh(); } catch (uiError) { console.error("Contact delete request succeeded but navigation failed", uiError); }
  }
  return <><Button type="button" variant="danger" onClick={() => setOpen(true)}>ขอลบผู้ติดต่อ</Button><Dialog open={open} onClose={close} closeOnBackdrop={false} title="ขอลบผู้ติดต่อ" description="คำขอลบจะถูกส่งให้ผู้ใหญ่บ้านตรวจสอบก่อนนำผู้ติดต่อออกจากรายการ" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={close} disabled={pending}>ยกเลิก</Button><Button type="button" variant="danger" onClick={submit} disabled={!valid || pending} isLoading={pending}>ส่งคำขอลบ</Button></div>}><Textarea autoFocus label="เหตุผล" required minLength={5} value={reason} onChange={(event) => { setReason(event.target.value); if (error) setError(""); }} error={error} helperText="อย่างน้อย 5 ตัวอักษร" className="min-h-32 text-base" /></Dialog></>;
}
