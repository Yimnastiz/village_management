"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { useToast } from "@/components/ui/toast";
import { archiveBroadcastAnnouncementAction, broadcastAnnouncementAction, updateBroadcastAnnouncementAction } from "./actions";

type BroadcastRow = { groupId: string; title: string; body: string; expiresAt: string | null; createdAtIso: string; audienceCount: number; status: "ACTIVE" | "EXPIRED" | "ARCHIVED" };
type Operation = "create" | "edit" | "archive";
type ExpiryMode = "ONE_HOUR" | "ONE_DAY" | "THREE_DAYS" | "SEVEN_DAYS" | "CUSTOM" | "NEVER" | "PRESERVE";
const labels = { ACTIVE: "กำลังแสดง", EXPIRED: "หมดอายุแล้ว", ARCHIVED: "ยกเลิกแล้ว" } as const;
const variants = { ACTIVE: "success", EXPIRED: "warning", ARCHIVED: "default" } as const;

export function BroadcastForm({ broadcasts }: { broadcasts: BroadcastRow[] }) {
  const router = useRouter(); const { pushToast } = useToast();
  const [operation, setOperation] = useState<Operation>("create"); const [groupId, setGroupId] = useState<string | null>(null);
  const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [expiryMode, setExpiryMode] = useState<ExpiryMode>("ONE_DAY");
  const [customValue, setCustomValue] = useState(""); const [customUnit, setCustomUnit] = useState<"MINUTES" | "HOURS">("HOURS");
  const [formOpen, setFormOpen] = useState(false); const [confirmOpen, setConfirmOpen] = useState(false); const [pending, setPending] = useState(false); const [draftData, setDraftData] = useState<FormData | null>(null);
  const reset = () => { setOperation("create"); setGroupId(null); setTitle(""); setBody(""); setExpiryMode("ONE_DAY"); setCustomValue(""); setCustomUnit("HOURS"); };
  const openCreate = () => { reset(); setFormOpen(true); };
  const openEdit = (broadcast: BroadcastRow) => { setOperation("edit"); setGroupId(broadcast.groupId); setTitle(broadcast.title); setBody(broadcast.body); setExpiryMode("PRESERVE"); setCustomValue(""); setFormOpen(true); };
  const requestArchive = (id: string) => { setOperation("archive"); setGroupId(id); setDraftData(null); setConfirmOpen(true); };
  const submitForm = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); if (expiryMode === "CUSTOM" && (!/^\d+$/.test(customValue) || Number(customValue) < 1)) { pushToast({ tone: "error", title: "ระยะเวลาไม่ถูกต้อง", description: "กรุณาระบุจำนวนเต็มอย่างน้อย 1 นาที" }); return; } const data = new FormData(event.currentTarget); if (operation === "edit" && groupId) data.set("broadcastGroupId", groupId); setDraftData(data); setConfirmOpen(true); };
  const confirm = async () => {
    setPending(true);
    try {
      if (operation === "archive") { const data = new FormData(); data.set("broadcastGroupId", groupId ?? ""); await archiveBroadcastAnnouncementAction(data); pushToast({ tone: "success", title: "ยกเลิกประกาศแล้ว", description: "ประกาศจะหยุดแสดงแก่ผู้รับ แต่ประวัติยังคงอยู่" }); }
      else if (operation === "edit") { await updateBroadcastAnnouncementAction(draftData!); pushToast({ tone: "success", title: "อัปเดตประกาศแล้ว", description: "อัปเดตประกาศของผู้รับทั้งหมดแล้ว" }); }
      else { await broadcastAnnouncementAction(draftData!); pushToast({ tone: "success", title: "ส่งประกาศแล้ว", description: "ระบบส่งประกาศให้ผู้ใช้ที่มีสมาชิกหมู่บ้านอยู่" }); }
      router.refresh(); setConfirmOpen(false); setFormOpen(false); reset();
    } catch (error) { pushToast({ tone: "error", title: operation === "archive" ? "ยกเลิกประกาศไม่สำเร็จ" : "บันทึกประกาศไม่สำเร็จ", description: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" }); }
    finally { setPending(false); }
  };
  const confirmation = operation === "archive" ? { title: "ยืนยันการยกเลิกประกาศ", description: "ประกาศจะหยุดแสดงแก่ผู้รับ แต่ข้อมูลประวัติจะยังคงอยู่", label: "ยกเลิกประกาศ", tone: "danger" as const } : operation === "edit" ? { title: "ยืนยันการแก้ไขประกาศ", description: "การแก้ไขจะอัปเดตประกาศของผู้รับทั้งหมด", label: "บันทึกการแก้ไข", tone: "default" as const } : { title: "ยืนยันการส่งประกาศ", description: "ประกาศนี้จะถูกส่งถึงผู้ใช้ที่มีสมาชิกหมู่บ้านทั้งหมด", label: "ส่งประกาศ", tone: "default" as const };
  return <div className="-mt-4 space-y-4 sm:-mt-6">
    <SuperAdminPageHeaderRegistration context={{ title: "ประกาศส่วนกลาง", description: "ส่งและจัดการประกาศสำคัญที่ต้องการแจ้งให้ผู้ใช้งานทั่วทั้งระบบทราบ" }} />
    <AdminPageToolbar sticky compact hideHeading title="ประกาศส่วนกลาง" actions={<Button type="button" onClick={openCreate} className="min-h-9 bg-cyan-600 hover:bg-cyan-700"><Plus className="mr-1.5 h-4 w-4" />สร้างประกาศ</Button>} />
    <section className="space-y-2 px-0 sm:px-0" aria-label="ประวัติประกาศ">
      {broadcasts.length ? broadcasts.map((broadcast) => <article key={broadcast.groupId} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="min-w-0 break-words font-semibold text-slate-900">{broadcast.title}</h2><Badge variant={variants[broadcast.status]}>{labels[broadcast.status]}</Badge></div><p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-sm text-slate-600">{broadcast.body}</p><div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500"><span>ผู้รับ {broadcast.audienceCount.toLocaleString("th-TH")} คน</span><span>สร้างเมื่อ {new Date(broadcast.createdAtIso).toLocaleString("th-TH")}</span><span>{broadcast.expiresAt ? `หมดอายุ: ${new Date(broadcast.expiresAt).toLocaleString("th-TH")}` : "ไม่หมดอายุ"}</span></div></div>{broadcast.status === "ACTIVE" ? <div className="flex shrink-0 flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => openEdit(broadcast)}>แก้ไข</Button><Button type="button" variant="danger" onClick={() => requestArchive(broadcast.groupId)}>ยกเลิกประกาศ</Button></div> : null}</div></article>) : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">ยังไม่มีประวัติประกาศ</div>}
    </section>
    {formOpen ? <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="broadcast-form-title"><form onSubmit={submitForm} className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 id="broadcast-form-title" className="text-lg font-semibold text-slate-900">{operation === "edit" ? "แก้ไขประกาศ" : "สร้างประกาศ"}</h2><p className="mt-1 text-sm text-slate-500">ส่งประกาศส่วนกลางถึงผู้รับตามสมาชิกหมู่บ้านที่ใช้งานอยู่</p></div><button type="button" onClick={() => { setFormOpen(false); reset(); }} className="text-sm text-slate-500 hover:text-slate-900">ปิด</button></div><div className="mt-5 space-y-4"><label className="block text-sm font-medium text-slate-700">หัวข้อ<input name="title" required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label><label className="block text-sm font-medium text-slate-700">เนื้อหา<textarea name="body" required rows={5} value={body} onChange={(e) => setBody(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label><div><p className="text-sm font-medium text-slate-700">ผู้รับ</p><p className="mt-1 text-sm text-slate-500">ผู้ใช้งานที่มีสถานะสมาชิกหมู่บ้านที่ใช้งานอยู่ โดยผู้ใช้หนึ่งคนจะได้รับประกาศเพียงหนึ่งครั้ง</p></div><label className="block text-sm font-medium text-slate-700">ระยะเวลาประกาศ<select name="expiryMode" value={expiryMode} onChange={(e) => setExpiryMode(e.target.value as ExpiryMode)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">{operation === "edit" ? <option value="PRESERVE">คงวันหมดอายุเดิม</option> : null}<option value="ONE_HOUR">1 ชั่วโมง</option><option value="ONE_DAY">1 วัน</option><option value="THREE_DAYS">3 วัน</option><option value="SEVEN_DAYS">7 วัน</option><option value="CUSTOM">กำหนดเอง</option><option value="NEVER">ไม่หมดอายุ</option></select></label>{expiryMode === "CUSTOM" ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">จำนวน<input name="customValue" type="number" min="1" max={customUnit === "HOURS" ? 8760 : 525600} step="1" inputMode="numeric" required value={customValue} onChange={(e) => setCustomValue(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label><label className="text-sm font-medium text-slate-700">หน่วย<select name="customUnit" aria-label="หน่วยระยะเวลา" value={customUnit} onChange={(e) => setCustomUnit(e.target.value as "MINUTES" | "HOURS")} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="MINUTES">นาที</option><option value="HOURS">ชั่วโมง</option></select></label></div> : null}</div><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => { setFormOpen(false); reset(); }}>ยกเลิก</Button><Button type="submit">{operation === "edit" ? "บันทึกการแก้ไข" : "ส่งประกาศ"}</Button></div></form></div> : null}
    <ConfirmDialog open={confirmOpen} title={confirmation.title} description={confirmation.description} confirmLabel={confirmation.label} tone={confirmation.tone} pending={pending} onClose={() => !pending && setConfirmOpen(false)} onConfirm={() => void confirm()} />
  </div>;
}
