"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type AuditDetail = {
  actor: string;
  event: string;
  item: string | null;
  time: string;
  changes: Array<{ label: string; before: string | null; after: string | null }>;
};

export function AuditDetailDialog({ detail, onClose }: { detail: AuditDetail | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!detail) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detail, onClose]);
  if (!detail) return null;
  return <div className="fixed inset-0 z-[90] flex items-end justify-end bg-slate-950/40 sm:items-stretch" role="presentation" onMouseDown={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="audit-detail-title" className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none" onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-3"><div><h2 id="audit-detail-title" className="text-lg font-semibold text-gray-900">รายละเอียดเหตุการณ์</h2><p className="mt-1 text-sm text-gray-500">ข้อมูลนี้เป็นบันทึกประวัติ ไม่สามารถแก้ไขหรือลบได้</p></div><button ref={closeRef} type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500" aria-label="ปิดรายละเอียด"><X aria-hidden="true" className="h-5 w-5" /></button></div>
      <dl className="mt-6 space-y-4 text-sm"><div><dt className="text-gray-500">ผู้ดำเนินการ</dt><dd className="mt-1 font-medium text-gray-900">{detail.actor}</dd></div><div><dt className="text-gray-500">เหตุการณ์</dt><dd className="mt-1 font-medium text-gray-900">{detail.event}</dd></div>{detail.item ? <div><dt className="text-gray-500">รายการ</dt><dd className="mt-1 font-medium text-gray-900">{detail.item}</dd></div> : null}<div><dt className="text-gray-500">วันและเวลา</dt><dd className="mt-1 font-medium text-gray-900">{detail.time}</dd></div></dl>
      {detail.changes.length ? <section className="mt-6 border-t border-gray-100 pt-5"><h3 className="font-semibold text-gray-900">การเปลี่ยนแปลง</h3><div className="mt-3 space-y-3">{detail.changes.map((change) => <div key={change.label} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm"><p className="font-medium text-gray-800">{change.label}</p>{change.before !== null ? <p className="mt-1 text-gray-500">เดิม: {change.before}</p> : null}{change.after !== null ? <p className="mt-1 text-gray-700">ใหม่: {change.after}</p> : null}</div>)}</div></section> : null}
      <div className="mt-6"><Button type="button" variant="outline" className="w-full" onClick={onClose}>ปิด</Button></div>
    </section>
  </div>;
}
