"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { deleteDownloadAction } from "../actions";

/** Kept as a compatible export for any future embedding; detail uses the richer management action set. */
export function DownloadDeleteButton({ fileId }: { fileId: string }) {
  const router = useRouter(); const toast = useToast(); const [open, setOpen] = useState(false); const [pending, setPending] = useState(false);
  const remove = async () => { setPending(true); const result = await deleteDownloadAction(fileId); setPending(false); if (!result.success) { toast.error("ลบเอกสารไม่สำเร็จ", result.error); return; } setOpen(false); toast.success("ลบเอกสารเรียบร้อยแล้ว"); router.push("/admin/downloads"); router.refresh(); };
  return <><Button type="button" variant="danger" onClick={() => setOpen(true)}>ลบเอกสาร</Button><ConfirmDialog open={open} title="ลบเอกสารนี้?" description="ไฟล์แนบและข้อมูลเอกสารจะถูกลบ และไม่สามารถย้อนกลับได้" confirmLabel="ลบเอกสาร" tone="danger" pending={pending} onClose={() => !pending && setOpen(false)} onConfirm={() => { void remove(); }} /></>;
}
