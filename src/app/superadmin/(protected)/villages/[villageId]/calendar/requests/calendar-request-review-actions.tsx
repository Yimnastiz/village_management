"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { reviewSuperAdminCalendarRequestAction } from "../../operational-actions";

export function CalendarRequestReviewActions({ villageId, requestId }: { villageId: string; requestId: string }) {
  const router = useRouter(); const toast = useToast();
  const [decision, setDecision] = useState<"APPROVE" | "REJECT" | null>(null);
  const [visibility, setVisibility] = useState("RESIDENT"); const [businessReason, setBusinessReason] = useState(""); const [pending, startTransition] = useTransition();
  const confirm = (supportReason: string) => { if (!decision) return; const normalizedBusinessReason = businessReason.trim(); if (decision === "REJECT" && (normalizedBusinessReason.length < 5 || normalizedBusinessReason.length > 500)) { toast.error("กรุณาระบุเหตุผลปฏิเสธ", "ระบุ 5–500 ตัวอักษร"); return; } startTransition(async () => { const data = new FormData(); data.set("decision", decision); data.set("visibility", visibility); data.set("supportReason", supportReason); data.set("businessReason", normalizedBusinessReason); const result = await reviewSuperAdminCalendarRequestAction(villageId, requestId, data); if (!result.success) { toast.error("บันทึกผลการพิจารณาไม่สำเร็จ", result.error); return; } toast.success(result.message); setBusinessReason(""); setDecision(null); router.refresh(); }); };
  return <div className="flex flex-wrap items-end gap-2"><Select label="การมองเห็นเมื่ออนุมัติ" value={visibility} onChange={(event) => setVisibility(event.target.value)} disabled={pending} options={[{ value: "RESIDENT", label: "เฉพาะลูกบ้าน" }, { value: "PUBLIC", label: "สาธารณะ" }]} /><Button type="button" disabled={pending} onClick={() => setDecision("APPROVE")}>อนุมัติ</Button><Button type="button" variant="danger" disabled={pending} onClick={() => setDecision("REJECT")}>ปฏิเสธ</Button><ActionReasonDialog open={decision !== null} action="content.request.reject" title={decision === "APPROVE" ? "ยืนยันการอนุมัติคำขอกิจกรรม" : "ยืนยันการปฏิเสธคำขอกิจกรรม"} description="ระบบจะดำเนินการหลังยืนยันและแจ้งผู้ดูแลหมู่บ้าน" reasonLabel="เหตุผลในการดำเนินการ" helperText="ระบุเหตุผลที่ผู้ดูแลระบบระดับสูงดำเนินการแทนผู้ดูแลหมู่บ้าน" requireReason minReasonLength={5} maxReasonLength={500} submitLabel="ยืนยันดำเนินการ" loading={pending} onCancel={() => { setBusinessReason(""); setDecision(null); }} onSubmit={confirm}>{decision === "REJECT" ? <Textarea label="เหตุผลที่ปฏิเสธคำขอกิจกรรม" value={businessReason} onChange={(event) => setBusinessReason(event.target.value)} required minLength={5} maxLength={500} rows={4} helperText="เหตุผลนี้จะแสดงแก่ผู้ขอกิจกรรม" disabled={pending} /> : null}</ActionReasonDialog></div>;
}
