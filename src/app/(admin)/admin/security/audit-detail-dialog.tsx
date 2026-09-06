"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type AuditDetail = {
  actor: string; actorRole?: string | null; event: string; item: string | null; referenceId?: string | null; time: string; formattedTime: string;
  changes: Array<{ label: string; before: string | null; after: string | null }>; reason: string | null; reasonLabel: string;
  resourceLabel?: string; village?: string; isSuperAdminIntervention?: boolean;
};

export function AuditDetailDialog({ detail, onClose }: { detail: AuditDetail | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!detail) return; closeRef.current?.focus(); const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, [detail, onClose]);
  if (!detail) return null;
  return <div className="fixed inset-0 z-[90] flex items-end justify-end bg-slate-950/40 sm:items-stretch" role="presentation" onMouseDown={onClose}><section role="dialog" aria-modal="true" aria-labelledby="audit-detail-title" className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none" onMouseDown={(event) => event.stopPropagation()}>
    <div className="flex items-start justify-between gap-3"><div><h2 id="audit-detail-title" className="text-lg font-semibold text-slate-900">รายละเอียดบันทึกกิจกรรม</h2><p className="mt-1 text-sm text-slate-500">ข้อมูลประวัติแบบอ่านอย่างเดียว</p></div><button ref={closeRef} type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-600" aria-label="ปิดรายละเอียด"><X className="h-5 w-5" aria-hidden="true" /></button></div>
    <dl className="mt-6 space-y-4 text-sm"><div><dt className="text-slate-500">ผู้ดำเนินการ</dt><dd className="mt-1 font-medium text-slate-900">{detail.actor}</dd></div>{detail.actorRole ? <div><dt className="text-slate-500">บทบาทผู้ดำเนินการ</dt><dd className="mt-1 font-medium text-slate-900">{detail.actorRole}</dd></div> : null}<div><dt className="text-slate-500">การดำเนินการ</dt><dd className="mt-1 font-medium text-slate-900">{detail.event}</dd></div>{detail.resourceLabel ? <div><dt className="text-slate-500">ประเภทข้อมูล</dt><dd className="mt-1 font-medium text-slate-900">{detail.resourceLabel}{detail.item ? ` · ${detail.item}` : ""}</dd></div> : null}{detail.village ? <div><dt className="text-slate-500">หมู่บ้าน</dt><dd className="mt-1 font-medium text-slate-900">{detail.village}</dd></div> : null}<div><dt className="text-slate-500">วันเวลา</dt><dd className="mt-1 font-medium text-slate-900"><time dateTime={detail.time}>{detail.formattedTime}</time></dd></div>{detail.reason ? <div className="rounded-lg border border-cyan-100 bg-cyan-50 p-3"><dt className="font-medium text-cyan-900">{detail.reasonLabel}</dt><dd className="mt-1 whitespace-pre-wrap text-cyan-950">{detail.reason}</dd></div> : null}{detail.isSuperAdminIntervention ? <div className="rounded-lg border border-violet-100 bg-violet-50 p-3 text-violet-900">การดำเนินการแทนผู้ดูแลหมู่บ้านโดยผู้ดูแลระบบระดับสูง</div> : null}</dl>
    {detail.changes.length ? <section className="mt-6 border-t border-slate-100 pt-5"><h3 className="font-semibold text-slate-900">การเปลี่ยนแปลง</h3><div className="mt-3 space-y-3">{detail.changes.map((change) => <div key={change.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"><p className="font-medium text-slate-800">{change.label}</p>{change.before !== null ? <p className="mt-1 text-slate-500">เดิม: {change.before}</p> : null}{change.after !== null ? <p className="mt-1 text-slate-700">ใหม่: {change.after}</p> : null}</div>)}</div></section> : null}
    {detail.referenceId ? <section className="mt-6 border-t border-slate-100 pt-5"><h3 className="text-sm font-semibold text-slate-700">ข้อมูลอ้างอิง</h3><p className="mt-2 break-all font-mono text-xs text-slate-500">{detail.referenceId}</p></section> : null}<div className="mt-6"><Button type="button" variant="outline" className="w-full" onClick={onClose}>ปิด</Button></div>
  </section></div>;
}
