"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { reviewSuperAdminCalendarRequestAction } from "../../operational-actions";

export function CalendarRequestReviewActions({ villageId, requestId }: { villageId: string; requestId: string }) {
  const router = useRouter(); const toast = useToast();
  const [decision, setDecision] = useState<"APPROVE" | "REJECT" | null>(null);
  const [visibility, setVisibility] = useState("RESIDENT"); const [pending, startTransition] = useTransition();
  const confirm = (supportReason: string) => { if (!decision) return; startTransition(async () => { const data = new FormData(); data.set("decision", decision); data.set("visibility", visibility); data.set("supportReason", supportReason); const result = await reviewSuperAdminCalendarRequestAction(villageId, requestId, data); if (!result.success) { toast.error("บันทึกผลการพิจารณาไม่สำเร็จ", result.error); return; } toast.success(result.message); setDecision(null); router.refresh(); }); };
  return <div className="flex flex-wrap items-end gap-2"><Select label="การมองเห็นเมื่ออนุมัติ" value={visibility} onChange={(event) => setVisibility(event.target.value)} options={[{ value: "RESIDENT", label: "เฉพาะลูกบ้าน" }, { value: "PUBLIC", label: "สาธารณะ" }]} /><Button type="button" onClick={() => setDecision("APPROVE")}>อนุมัติ</Button><Button type="button" variant="danger" onClick={() => setDecision("REJECT")}>ปฏิเสธ</Button><ActionReasonDialog open={decision !== null} action="content.request.reject" title={decision === "APPROVE" ? "ยืนยันการอนุมัติคำขอกิจกรรม" : "ยืนยันการปฏิเสธคำขอกิจกรรม"} description="ระบบจะดำเนินการหลังยืนยันและแจ้งผู้ดูแลหมู่บ้าน" reasonLabel="เหตุผลในการดำเนินการ" helperText="ระบุเหตุผลที่ผู้ดูแลระบบระดับสูงดำเนินการแทนผู้ดูแลหมู่บ้าน" requireReason minReasonLength={5} maxReasonLength={500} submitLabel="ยืนยันดำเนินการ" loading={pending} onCancel={() => setDecision(null)} onSubmit={confirm} /></div>;
}
