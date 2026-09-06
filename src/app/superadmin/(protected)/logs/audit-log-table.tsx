"use client";

import { useState } from "react";
import { AuditDetailDialog, type AuditDetail } from "@/app/(admin)/admin/security/audit-detail-dialog";

export type AuditLogRow = {
  id: string; createdAt: string; actionLabel: string; actionTone: "success" | "info" | "danger" | "warning" | "neutral"; actor: string; actorRole: string | null;
  resourceLabel: string; target: string | null; villageName: string | null; villageMoo: number | null; referenceId: string | null; detail: AuditDetail & { resourceLabel?: string; village?: string; isSuperAdminIntervention?: boolean };
};

const tones = { success: "border-emerald-200 bg-emerald-50 text-emerald-700", info: "border-sky-200 bg-sky-50 text-sky-700", warning: "border-amber-200 bg-amber-50 text-amber-700", danger: "border-rose-200 bg-rose-50 text-rose-700", neutral: "border-slate-200 bg-slate-50 text-slate-600" };
const roles: Record<string, string> = { HEADMAN: "ผู้ใหญ่บ้าน", ASSISTANT_HEADMAN: "ผู้ช่วยผู้ใหญ่บ้าน", SUPERADMIN: "ผู้ดูแลระบบระดับสูง", ADMIN: "ผู้ดูแลระบบระดับสูง", USER: "ผู้ใช้งาน" };

export function AuditLogTable({ rows }: { rows: AuditLogRow[] }) {
  const [selected, setSelected] = useState<AuditDetail | null>(null);
  return <><div className="overflow-x-auto"><table className="min-w-[760px] w-full text-sm"><thead><tr className="border-b bg-slate-50 text-left text-xs font-medium text-slate-600"><th className="px-4 py-3">เวลา</th><th className="px-4 py-3">ผู้กระทำ</th><th className="px-4 py-3">การดำเนินการ</th><th className="px-4 py-3">รายการ</th><th className="px-4 py-3">หมู่บ้าน</th><th className="px-4 py-3 text-right">รายละเอียด</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600"><time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Bangkok" })}</time></td><td className="max-w-44 px-4 py-3"><p className="break-words font-medium text-slate-800">{row.actor}</p><p className="mt-0.5 text-xs text-slate-500">{row.actorRole ? roles[row.actorRole] ?? row.actorRole : "ระบบ"}</p></td><td className="px-4 py-3"><span className={`inline-flex max-w-32 rounded-full border px-2 py-1 text-xs font-medium ${tones[row.actionTone]}`}>{row.actionLabel}</span></td><td className="max-w-56 px-4 py-3"><p className="font-medium text-slate-800">{row.resourceLabel}</p>{row.target ? <p className="mt-0.5 truncate text-xs text-slate-500" title={row.target}>{row.target}</p> : null}</td><td className="px-4 py-3 text-slate-700">{row.villageName ? `${row.villageName}${row.villageMoo ? ` · หมู่ ${row.villageMoo}` : ""}` : "ส่วนกลาง"}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => setSelected(row.detail)} className="whitespace-nowrap rounded-md px-2 py-1 text-sm font-medium text-cyan-700 hover:bg-cyan-50 focus:outline-none focus:ring-2 focus:ring-cyan-600">ดูรายละเอียด</button></td></tr>)}</tbody></table></div><AuditDetailDialog detail={selected} onClose={() => setSelected(null)} /></>;
}
