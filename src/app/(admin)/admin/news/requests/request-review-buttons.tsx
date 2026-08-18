"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { adminApproveNewsSubmissionAction, adminRejectNewsSubmissionAction } from "../actions";

type Props = { requestId: string; initialVisibility: "PUBLIC" | "RESIDENT_ONLY"; initialIsPinned: boolean; showDisplaySettings: boolean };

function SettingSwitch({ label, helper, checked, onChange }: { label: string; helper: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-gray-200 px-4 py-3 transition hover:border-gray-300"><span><span className="block text-sm font-medium text-gray-900">{label}</span><span className="mt-1 block text-xs leading-5 text-gray-500">{helper}</span></span><span className="relative mt-0.5 inline-flex shrink-0"><input type="checkbox" className="peer sr-only" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span aria-hidden className="h-6 w-11 rounded-full bg-gray-200 transition peer-checked:bg-green-700 peer-focus-visible:ring-2 peer-focus-visible:ring-green-500 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" /></span></label>;
}

export function RequestReviewButtons({ requestId, initialVisibility, initialIsPinned, showDisplaySettings }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [isPublic, setIsPublic] = useState(initialVisibility === "PUBLIC");
  const [isPinned, setIsPinned] = useState(initialIsPinned);
  const busy = isApproving || isRejecting;

  const onApprove = async () => {
    setIsApproving(true);
    const result = await adminApproveNewsSubmissionAction(requestId, { visibility: isPublic ? "PUBLIC" : "RESIDENT_ONLY", isPinned });
    setIsApproving(false);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("อนุมัติคำขอข่าวเรียบร้อยแล้ว");
    router.push(`/admin/news/${result.newsId}`);
    router.refresh();
  };
  const onReject = async () => {
    if (reason.trim().length < 5) { setReasonError("กรุณาระบุอย่างน้อย 5 ตัวอักษร"); return; }
    setIsRejecting(true);
    const result = await adminRejectNewsSubmissionAction(requestId, reason);
    setIsRejecting(false);
    if (!result.success) { setReasonError(result.error); return; }
    toast.success("บันทึกการไม่อนุมัติเรียบร้อยแล้ว");
    setRejectOpen(false);
    setReason("");
    router.refresh();
  };

  return <section className="space-y-3 border-t border-gray-100 pt-5">{showDisplaySettings ? <><h2 className="font-semibold text-gray-900">การตั้งค่าก่อนอนุมัติ</h2><div className="space-y-2"><SettingSwitch label="เผยแพร่สาธารณะ" helper="เปิดเพื่อให้บุคคลทั่วไปสามารถเห็นข่าวนี้ได้" checked={isPublic} onChange={setIsPublic} /><SettingSwitch label="ปักหมุดข่าว" helper="แสดงข่าวนี้เด่นกว่าข่าวทั่วไป" checked={isPinned} onChange={setIsPinned} /></div></> : null}<div className="flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row"><Button onClick={onApprove} isLoading={isApproving} disabled={busy}>อนุมัติ</Button><Button variant="danger" onClick={() => setRejectOpen(true)} disabled={busy}>ไม่อนุมัติ</Button></div><ConfirmDialog open={rejectOpen} title="ไม่อนุมัติคำขอข่าว" description="กรุณาระบุเหตุผลเพื่อแจ้งให้ผู้ส่งคำขอทราบ" confirmLabel="ยืนยันไม่อนุมัติ" tone="danger" pending={isRejecting} confirmDisabled={reason.trim().length < 5} onClose={() => { if (!isRejecting) { setRejectOpen(false); setReasonError(""); } }} onConfirm={() => { void onReject(); }}><Textarea autoFocus label="เหตุผล *" value={reason} onChange={(event) => { setReason(event.target.value); if (reasonError) setReasonError(""); }} error={reasonError} helperText="กรุณาระบุ 5–500 ตัวอักษร" minLength={5} maxLength={500} required className="min-h-28 text-base" /></ConfirmDialog></section>;
}
