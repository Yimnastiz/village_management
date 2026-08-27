"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { useToast } from "@/components/ui/toast";
import { deleteDownloadAction } from "../actions";

/** Kept as a compatible export for any future embedding; detail uses the richer management action set. */
export function DownloadDeleteButton({ fileId }: { fileId: string }) {
  const router = useRouter(); const toast = useToast(); const [open, setOpen] = useState(false); const [pending, setPending] = useState(false);
  const remove = async (reason: string) => { setPending(true); const result = await deleteDownloadAction(fileId, reason); setPending(false); if (!result.success) { toast.error("ลบเอกสารไม่สำเร็จ", result.error); return; } setOpen(false); toast.success("ลบเอกสารเรียบร้อยแล้ว"); router.push("/admin/downloads"); router.refresh(); };
  return <><Button type="button" variant="danger" onClick={() => setOpen(true)}>ลบเอกสาร</Button><ActionReasonDialog open={open} action="content.delete" title="ลบเอกสาร" description="ไฟล์แนบและข้อมูลเอกสารจะถูกลบ และบันทึกเหตุผลใน Audit Log" submitLabel="ลบเอกสาร" loading={pending} onCancel={() => setOpen(false)} onSubmit={remove} /></>;
}
