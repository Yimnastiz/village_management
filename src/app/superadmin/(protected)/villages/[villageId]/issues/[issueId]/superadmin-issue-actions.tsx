"use client";

import { useState } from "react";
import { Globe, Lock, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { addSuperAdminIssueMessageAction, deleteSuperAdminIssueAction, updateSuperAdminIssueAction } from "../../operational-actions";

type Props = { villageId: string; issueId: string; stageOptions: { value: string; label: string }[]; statusOnly?: boolean };
type IntendedAction = { type: "status"; status: string; note: string } | { type: "message"; content: string };

export function SuperAdminIssueActions({ villageId, issueId, stageOptions, statusOnly = false }: Props) {
  const router = useRouter(); const { pushToast } = useToast(); const [status, setStatus] = useState(stageOptions[0]?.value ?? ""); const [note, setNote] = useState(""); const [content, setContent] = useState(""); const [isInternal, setIsInternal] = useState(false); const [intended, setIntended] = useState<IntendedAction | null>(null); const [supportReason, setSupportReason] = useState(""); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  const openStatus = (event: React.FormEvent) => { event.preventDefault(); if (!status) return; setError(""); setSupportReason(""); setIntended({ type: "status", status, note: note.trim() }); };
  const openMessage = (event: React.FormEvent) => { event.preventDefault(); if (content.trim().length < 2) { setError("กรุณาระบุข้อความอย่างน้อย 2 ตัวอักษร"); return; } setError(""); setSupportReason(""); setIntended({ type: "message", content: content.trim() }); };
  const confirm = async () => { if (!intended || pending) return; const reason = supportReason.trim(); if (reason.length < 5 || reason.length > 500) return; setPending(true); setError(""); const data = new FormData(); data.set("supportReason", reason); if (intended.type === "status") { data.set("status", intended.status); data.set("note", intended.note); } else { data.set("content", intended.content); data.set("isInternal", String(isInternal)); } const result = intended.type === "status" ? await updateSuperAdminIssueAction(villageId, issueId, data) : await addSuperAdminIssueMessageAction(villageId, issueId, data); setPending(false); if (!result.success) { setError(result.error); pushToast({ tone: "error", title: "ดำเนินการไม่สำเร็จ", description: result.error }); return; } if (intended.type === "status") setNote(""); else { setContent(""); setIsInternal(false); } setIntended(null); setSupportReason(""); pushToast({ tone: "success", title: result.message }); router.refresh(); };
  const reasonInvalid = supportReason.trim().length < 5 || supportReason.trim().length > 500;
  return <>{!statusOnly ? <form onSubmit={openMessage} className="space-y-3"><Textarea label="เพิ่มข้อความ" value={content} onChange={(event) => { setContent(event.target.value); setError(""); }} placeholder="พิมพ์ข้อความสำหรับผู้แจ้งปัญหา..." rows={3} disabled={pending} /><button type="button" onClick={() => setIsInternal((value) => !value)} className="text-xs text-slate-500">{isInternal ? <><Lock className="mr-1 inline h-3.5 w-3.5" />บันทึกภายใน (ผู้แจ้งมองไม่เห็น)</> : <><Globe className="mr-1 inline h-3.5 w-3.5" />ข้อความสาธารณะ (ผู้แจ้งมองเห็น)</>}</button>{error && !intended ? <p className="text-xs text-red-600">{error}</p> : null}<Button type="submit" size="sm" disabled={pending}><MessageSquare className="mr-1 h-4 w-4" />ส่งข้อความ</Button></form> : <form onSubmit={openStatus} className="space-y-3">{stageOptions.length ? <><Select label="เปลี่ยนสถานะ" value={status} onChange={(event) => { setStatus(event.target.value); setError(""); }} options={stageOptions} disabled={pending} /><Textarea label="หมายเหตุความคืบหน้า (ไม่บังคับ)" value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="เช่น ช่างออกตรวจสอบแล้ว..." disabled={pending} />{error && !intended ? <p className="text-xs text-red-600">{error}</p> : null}<Button type="submit" size="sm" disabled={!status || pending}>บันทึกสถานะ</Button></> : <p className="text-sm text-slate-500">สถานะนี้สิ้นสุดกระบวนการแล้ว</p>}</form>}<ConfirmDialog open={Boolean(intended)} title={intended?.type === "status" ? "ยืนยันการเปลี่ยนสถานะ" : "ยืนยันการส่งข้อความ"} description="การดำเนินการแทนผู้ดูแลหมู่บ้านจะถูกบันทึกใน Audit Log และแจ้งผู้ดูแลหมู่บ้าน" confirmLabel="ยืนยันการดำเนินการ" pending={pending} confirmDisabled={reasonInvalid} onClose={() => { if (!pending) { setIntended(null); setError(""); } }} onConfirm={confirm}><Textarea label="เหตุผลในการดำเนินการ" required value={supportReason} onChange={(event) => { setSupportReason(event.target.value); setError(""); }} error={error || (supportReason.length > 0 && reasonInvalid ? "กรุณาระบุ 5–500 ตัวอักษร" : undefined)} helperText="ระบุเหตุผลที่ผู้ดูแลระบบระดับสูงดำเนินการแทนผู้ดูแลหมู่บ้าน" minLength={5} maxLength={500} rows={4} autoFocus disabled={pending} /></ConfirmDialog></>;
}

export function SuperAdminDeleteIssueButton({ villageId, issueId }: Pick<Props, "villageId" | "issueId">) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const [businessReason, setBusinessReason] = useState("");
  const [supportReason, setSupportReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const businessInvalid = businessReason.trim().length < 5 || businessReason.trim().length > 500;
  const supportInvalid = supportReason.trim().length < 5 || supportReason.trim().length > 500;

  const confirmDelete = async () => {
    if (pending || businessInvalid || supportInvalid) return;
    setPending(true);
    setError("");
    const formData = new FormData();
    formData.set("businessReason", businessReason.trim());
    formData.set("supportReason", supportReason.trim());
    const result = await deleteSuperAdminIssueAction(villageId, issueId, formData);
    setPending(false);
    if (!result.success) {
      setError(result.error);
      pushToast({ tone: "error", title: "ลบคำร้องไม่สำเร็จ", description: result.error });
      return;
    }
    pushToast({ tone: "success", title: result.message });
    router.push(`/superadmin/villages/${villageId}/issues`);
  };

  return <div className="border-t border-gray-100 pt-4">
    <Button type="button" variant="danger" size="sm" onClick={() => { setError(""); setOpen(true); }} disabled={pending}>
      <Trash2 className="mr-1 h-4 w-4" />ลบคำร้อง
    </Button>
    <ConfirmDialog
      open={open}
      title="ลบคำร้องปัญหา"
      description="การดำเนินการนี้จะลบคำร้องออกจากระบบ โปรดตรวจสอบข้อมูลก่อนยืนยัน"
      confirmLabel="ลบคำร้อง"
      cancelLabel="ยกเลิก"
      tone="danger"
      pending={pending}
      confirmDisabled={businessInvalid || supportInvalid}
      onClose={() => { if (!pending) { setOpen(false); setError(""); } }}
      onConfirm={confirmDelete}
    >
      <div className="space-y-4">
        <Textarea
          label="เหตุผลที่ลบคำร้อง"
          required
          minLength={5}
          maxLength={500}
          value={businessReason}
          onChange={(event) => { setBusinessReason(event.target.value); setError(""); }}
          error={businessReason.length > 0 && businessInvalid ? "กรุณาระบุ 5–500 ตัวอักษร" : undefined}
          helperText="ระบุเหตุผลที่คำร้องนี้ถูกลบหรือไม่ควรดำเนินการต่อ"
          rows={4}
          autoFocus
          disabled={pending}
        />
        <Textarea
          label="เหตุผลในการดำเนินการแทนผู้ดูแลหมู่บ้าน"
          required
          minLength={5}
          maxLength={500}
          value={supportReason}
          onChange={(event) => { setSupportReason(event.target.value); setError(""); }}
          error={error || (supportReason.length > 0 && supportInvalid ? "กรุณาระบุ 5–500 ตัวอักษร" : undefined)}
          helperText="ระบุเหตุผลที่ผู้ดูแลระบบระดับสูงดำเนินการแทนผู้ดูแลหมู่บ้าน"
          rows={4}
          disabled={pending}
        />
      </div>
    </ConfirmDialog>
  </div>;
}
