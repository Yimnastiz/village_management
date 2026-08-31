"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { useToast } from "@/components/ui/toast";
import { getThaiRoleLabel } from "@/lib/user-display";
import { appointVillageAdministratorAction, updateVillageAdministratorAction } from "./actions";

type Admin = { id: string; role: "HEADMAN" | "ASSISTANT_HEADMAN"; status: "ACTIVE" | "SUSPENDED"; createdAt: string; updatedAt: string; user: { id: string; name: string; phoneNumber: string; email: string | null; accountStatus: string } };
type Draft = { kind: "appoint"; userId: string; role: Admin["role"]; confirmReplacement: boolean } | { kind: "update"; membershipId: string; operation: "SUSPEND" | "ACTIVATE" | "CHANGE_ROLE"; role?: Admin["role"]; confirmVacancy: boolean; confirmReplacement: boolean };

const date = (value: string) => new Date(value).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
const status = (value: string) => value === "ACTIVE" ? "ใช้งานอยู่" : "ระงับ";

export function AdminManagement({ villageId, users, admins, activeHeadmanId }: { villageId: string; users: { id: string; name: string; phoneNumber: string }[]; admins: Admin[]; activeHeadmanId: string | null }) {
  const router = useRouter(); const toast = useToast();
  const [appointmentOpen, setAppointmentOpen] = useState(false); const [reasonOpen, setReasonOpen] = useState(false); const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState(""); const [role, setRole] = useState<Admin["role"]>("HEADMAN"); const [replacement, setReplacement] = useState(false); const [draft, setDraft] = useState<Draft | null>(null);
  const submit = async (reason: string) => {
    if (!draft) return;
    setBusy(true);
    try {
      const form = new FormData(); form.set("reason", reason);
      if (draft.kind === "appoint") { form.set("userId", draft.userId); form.set("role", draft.role); form.set("confirmReplacement", String(draft.confirmReplacement)); await appointVillageAdministratorAction(villageId, form); }
      else { form.set("membershipId", draft.membershipId); form.set("operation", draft.operation); if (draft.role) form.set("role", draft.role); form.set("confirmVacancy", String(draft.confirmVacancy)); form.set("confirmReplacement", String(draft.confirmReplacement)); await updateVillageAdministratorAction(villageId, form); }
      toast.success("บันทึกเรียบร้อยแล้ว"); setReasonOpen(false); setDraft(null); router.refresh();
    } catch (error) { toast.error("ดำเนินการไม่สำเร็จ", error instanceof Error ? error.message : "เกิดข้อผิดพลาด"); }
    finally { setBusy(false); }
  };
  const openAppointmentReason = () => {
    if (!userId) { toast.error("กรุณาเลือกผู้ใช้"); return; }
    const replaces = role === "HEADMAN" && activeHeadmanId !== null && activeHeadmanId !== userId;
    if (replaces && !replacement) { toast.error("กรุณายืนยันการแทนที่ผู้ใหญ่บ้านเดิม"); return; }
    setDraft({ kind: "appoint", userId, role, confirmReplacement: replacement }); setAppointmentOpen(false); setReasonOpen(true);
  };
  const openUpdateReason = (next: Draft) => { setDraft(next); setReasonOpen(true); };
  return <>
    <div className="flex flex-wrap items-center gap-2"><Button type="button" onClick={() => setAppointmentOpen(true)}>แต่งตั้งผู้ดูแล</Button></div>
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">ชื่อ</th><th className="px-4 py-3">บทบาท</th><th className="px-4 py-3">โทรศัพท์ / อีเมล</th><th className="px-4 py-3">สถานะ</th><th className="px-4 py-3">แต่งตั้งเมื่อ</th><th className="px-4 py-3">อัปเดตล่าสุด</th><th className="px-4 py-3 text-center">การจัดการ</th></tr></thead><tbody className="divide-y">{admins.map((admin) => <tr key={admin.id}><td className="max-w-48 truncate px-4 py-3 font-medium text-slate-900">{admin.user.name}</td><td className="px-4 py-3"><Badge variant="outline">{getThaiRoleLabel(admin.role)}</Badge></td><td className="px-4 py-3 text-slate-600"><p>{admin.user.phoneNumber || "-"}</p><p className="max-w-44 truncate text-xs">{admin.user.email ?? "-"}</p></td><td className="px-4 py-3"><Badge variant={admin.status === "ACTIVE" ? "success" : "danger"}>{status(admin.status)}</Badge></td><td className="px-4 py-3 text-slate-600">{date(admin.createdAt)}</td><td className="px-4 py-3 text-slate-600">{date(admin.updatedAt)}</td><td className="px-4 py-3 text-center"><AdminActions admin={admin} activeHeadmanId={activeHeadmanId} onPrepare={openUpdateReason} /></td></tr>)}</tbody></table></div>
      <div className="grid gap-3 p-3 md:hidden">{admins.map((admin) => <article key={admin.id} className="rounded-lg border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{admin.user.name}</p><p className="mt-1 text-xs text-slate-500">{admin.user.phoneNumber || "-"}{admin.user.email ? ` · ${admin.user.email}` : ""}</p></div><Badge variant={admin.status === "ACTIVE" ? "success" : "danger"}>{status(admin.status)}</Badge></div><div className="mt-3 flex flex-wrap gap-2"><Badge variant="outline">{getThaiRoleLabel(admin.role)}</Badge><span className="text-xs text-slate-500">อัปเดต {date(admin.updatedAt)}</span></div><div className="mt-4"><AdminActions admin={admin} activeHeadmanId={activeHeadmanId} onPrepare={openUpdateReason} /></div></article>)}</div>
      {!admins.length ? <p className="p-10 text-center text-sm text-slate-500">ไม่พบผู้ดูแลตามตัวกรอง</p> : null}
    </div>
    <Dialog open={appointmentOpen} title="แต่งตั้งผู้ดูแลหมู่บ้าน" description="เลือกบัญชีที่มีอยู่ในหมู่บ้านนี้ แล้วระบุเหตุผลในขั้นตอนยืนยัน" onClose={() => setAppointmentOpen(false)} footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => setAppointmentOpen(false)}>ยกเลิก</Button><Button onClick={openAppointmentReason}>ดำเนินการต่อ</Button></div>}>
      <div className="grid gap-4"><label className="grid gap-1.5 text-sm font-medium">ผู้ใช้<select value={userId} onChange={(event) => setUserId(event.target.value)} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 font-normal"><option value="">เลือกผู้ใช้ในหมู่บ้านนี้</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.phoneNumber}</option>)}</select></label><label className="grid gap-1.5 text-sm font-medium">บทบาท<select value={role} onChange={(event) => setRole(event.target.value as Admin["role"])} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 font-normal"><option value="HEADMAN">ผู้ใหญ่บ้าน</option><option value="ASSISTANT_HEADMAN">ผู้ช่วยผู้ใหญ่บ้าน</option></select></label>{role === "HEADMAN" && activeHeadmanId && activeHeadmanId !== userId ? <label className="flex gap-2 text-sm text-slate-700"><input type="checkbox" checked={replacement} onChange={(event) => setReplacement(event.target.checked)} />ยืนยันการแทนที่ผู้ใหญ่บ้านเดิม โดยบัญชีเดิมจะถูกระงับ</label> : null}</div>
    </Dialog>
    <ActionReasonDialog open={reasonOpen} action="member.role.assign" title="ยืนยันการดำเนินการ" description="การเปลี่ยนแปลงจะเกิดขึ้นหลังยืนยันเท่านั้น" submitLabel="ยืนยันการดำเนินการ" reasonLabel="เหตุผลในการดำเนินการ" helperText="ระบุเหตุผลประกอบการดำเนินการของผู้ดูแลระบบระดับสูง" requireReason minReasonLength={5} maxReasonLength={500} loading={busy} onCancel={() => setReasonOpen(false)} onSubmit={submit} />
  </>;
}

function AdminActions({ admin, activeHeadmanId, onPrepare }: { admin: Admin; activeHeadmanId: string | null; onPrepare: (draft: Draft) => void }) {
  const [open, setOpen] = useState(false); const [operation, setOperation] = useState<"SUSPEND" | "ACTIVATE" | "CHANGE_ROLE">(admin.status === "ACTIVE" ? "SUSPEND" : "ACTIVATE"); const [role, setRole] = useState<Admin["role"]>(admin.role === "HEADMAN" ? "ASSISTANT_HEADMAN" : "HEADMAN"); const [vacancy, setVacancy] = useState(false); const [replacement, setReplacement] = useState(false);
  const changing = operation === "CHANGE_ROLE"; const needsVacancy = admin.role === "HEADMAN" && (operation === "SUSPEND" || (changing && role !== "HEADMAN")); const needsReplacement = changing && role === "HEADMAN" && activeHeadmanId !== null && activeHeadmanId !== admin.user.id;
  const next = () => { if (needsVacancy && !vacancy) return; if (needsReplacement && !replacement) return; onPrepare({ kind: "update", membershipId: admin.id, operation, ...(changing ? { role } : {}), confirmVacancy: vacancy, confirmReplacement: replacement }); setOpen(false); };
  return <><Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>จัดการ</Button><Dialog open={open} title={`จัดการ: ${admin.user.name}`} description="เลือกการดำเนินการก่อนระบุเหตุผลยืนยัน" onClose={() => setOpen(false)} footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button><Button variant={operation === "SUSPEND" ? "danger" : "primary"} onClick={next} disabled={(needsVacancy && !vacancy) || (needsReplacement && !replacement)}>ดำเนินการต่อ</Button></div>}><div className="grid gap-4"><label className="grid gap-1.5 text-sm font-medium">การดำเนินการ<select value={operation} onChange={(event) => setOperation(event.target.value as typeof operation)} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 font-normal">{admin.status === "ACTIVE" ? <><option value="SUSPEND">ระงับการใช้งาน</option><option value="CHANGE_ROLE">เปลี่ยนบทบาท</option></> : <option value="ACTIVATE">เปิดใช้งาน</option>}</select></label>{changing ? <label className="grid gap-1.5 text-sm font-medium">บทบาทใหม่<select value={role} onChange={(event) => setRole(event.target.value as Admin["role"])} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 font-normal"><option value="HEADMAN">ผู้ใหญ่บ้าน</option><option value="ASSISTANT_HEADMAN">ผู้ช่วยผู้ใหญ่บ้าน</option></select></label> : null}{needsVacancy ? <label className="flex gap-2 text-sm"><input type="checkbox" checked={vacancy} onChange={(event) => setVacancy(event.target.checked)} />ยืนยันการเว้นว่างตำแหน่งผู้ใหญ่บ้าน</label> : null}{needsReplacement ? <label className="flex gap-2 text-sm"><input type="checkbox" checked={replacement} onChange={(event) => setReplacement(event.target.checked)} />ยืนยันการแทนที่ผู้ใหญ่บ้านเดิม</label> : null}</div></Dialog></>;
}
