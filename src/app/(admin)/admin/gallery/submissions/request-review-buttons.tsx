"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { adminApproveGalleryItemSubmissionAction, adminRejectGalleryItemSubmissionAction } from "../actions";

export function GallerySubmissionReviewButtons({ submissionId, compact = false }: { submissionId: string; compact?: boolean }) {
  const router = useRouter(); const toast = useToast();
  const [mode, setMode] = useState<"approve" | "reject" | null>(null); const [note, setNote] = useState(""); const [pending, setPending] = useState(false);
  const submit = async () => {
    if (!mode) return; setPending(true);
    const result = mode === "approve" ? await adminApproveGalleryItemSubmissionAction(submissionId, note) : await adminRejectGalleryItemSubmissionAction(submissionId, note);
    setPending(false);
    if (!result.success) { toast.error(result.error); return; }
    toast.success(mode === "approve" ? "อนุมัติคำขอเรียบร้อยแล้ว" : "ไม่อนุมัติคำขอเรียบร้อยแล้ว"); setMode(null); setNote(""); router.refresh();
  };
  return <><div className="flex flex-wrap gap-2"><Button size={compact ? "sm" : "md"} onClick={() => setMode("approve")}>อนุมัติ</Button><Button size={compact ? "sm" : "md"} variant="danger" onClick={() => setMode("reject")}>ไม่อนุมัติ</Button></div><ConfirmDialog open={mode !== null} title={mode === "reject" ? "ไม่อนุมัติคำขอ" : "อนุมัติคำขอ"} description={mode === "reject" ? "โปรดระบุเหตุผลอย่างน้อย 5 ตัวอักษร" : "เพิ่มรูปภาพนี้เข้าอัลบั้ม"} confirmLabel={mode === "reject" ? "ยืนยันไม่อนุมัติ" : "ยืนยันอนุมัติ"} tone={mode === "reject" ? "danger" : "default"} pending={pending} confirmDisabled={mode === "reject" && note.trim().length < 5} onClose={() => { setMode(null); setNote(""); }} onConfirm={submit}><label className="block text-sm font-medium text-gray-700">{mode === "reject" ? "เหตุผล *" : "หมายเหตุถึงผู้ส่ง (ไม่บังคับ)"}<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} className="mt-1 min-h-24 w-full rounded-lg border border-gray-300 p-2 text-sm" required={mode === "reject"} /></label></ConfirmDialog></>;
}
