"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { CreateAppointmentForm, type CreateAppointmentInput } from "@/app/(admin)/admin/appointments/create-appointment-form";
import { createSuperAdminAppointmentAction } from "../operational-actions";

export function CreateSuperAdminAppointmentButton({ villageId }: { villageId: string }) {
  const { pushToast } = useToast();
  const [formOpen, setFormOpen] = useState(false); const [reasonOpen, setReasonOpen] = useState(false); const [pending, setPending] = useState(false);
  const [input, setInput] = useState<CreateAppointmentInput | null>(null); const [supportReason, setSupportReason] = useState(""); const [error, setError] = useState("");
  const reasonInvalid = supportReason.trim().length < 5 || supportReason.trim().length > 500;
  const continueToReason = async (next: CreateAppointmentInput) => { setInput(next); setError(""); setReasonOpen(true); return { success: true }; };
  const create = async () => {
    if (!input || pending || reasonInvalid) return;
    setPending(true); setError("");
    const result = await createSuperAdminAppointmentAction(villageId, { ...input, supportReason: supportReason.trim() });
    setPending(false);
    if (!result.success) { setError(result.error); pushToast({ tone: "error", title: "สร้างนัดหมายไม่สำเร็จ", description: result.error }); return; }
    setReasonOpen(false); setFormOpen(false); setInput(null); setSupportReason("");
    pushToast({ tone: "success", title: "สร้างนัดหมายเรียบร้อยแล้ว" });
  };
  return <><Button size="sm" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" />สร้างนัดหมาย</Button>
    <Dialog open={formOpen} onClose={() => !pending && setFormOpen(false)} closeOnBackdrop={!pending} closeOnEscape={!pending} title="สร้างนัดหมายให้ลูกบ้าน" footer={null}>
      <CreateAppointmentForm onClose={() => setFormOpen(false)} onPendingChange={setPending} residentsUrl={`/api/superadmin/villages/${villageId}/appointments/residents`} onSubmitAppointment={continueToReason} closeOnSuccess={false} />
    </Dialog>
    <Dialog open={reasonOpen} onClose={() => !pending && setReasonOpen(false)} closeOnBackdrop={!pending} closeOnEscape={!pending} title="ยืนยันการสร้างนัดหมาย" description="การดำเนินการแทนผู้ดูแลหมู่บ้านจะถูกบันทึกใน Audit Log และแจ้งผู้ดูแลหมู่บ้าน" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={pending} onClick={() => setReasonOpen(false)}>ย้อนกลับ</Button><Button type="button" disabled={pending || reasonInvalid} isLoading={pending} onClick={create}>ยืนยันการสร้างนัดหมาย</Button></div>}>
      <Textarea label="เหตุผลในการดำเนินการ" required value={supportReason} onChange={(event) => { setSupportReason(event.target.value); setError(""); }} error={error || (supportReason.length > 0 && reasonInvalid ? "กรุณาระบุเหตุผล 5–500 ตัวอักษร" : undefined)} helperText="ระบุเหตุผลที่ผู้ดูแลระบบระดับสูงสร้างนัดหมายแทนผู้ดูแลหมู่บ้าน" minLength={5} maxLength={500} rows={4} autoFocus disabled={pending} />
    </Dialog>
  </>;
}
