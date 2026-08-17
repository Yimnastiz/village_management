"use client";

import { useState } from "react";
import { CircleCheck, CircleX, LogIn, Pencil, Plus, ShieldAlert, Trash2, UserCog } from "lucide-react";
import { AuditDetailDialog, type AuditDetail } from "./audit-detail-dialog";

export type AuditListEvent = AuditDetail & { id: string; icon: "plus" | "pencil" | "trash" | "check" | "x" | "login" | "shield" | "user-cog"; tone: "success" | "info" | "danger" | "warning" | "neutral"; dateGroup: string; shortTime: string };

const icons = { plus: Plus, pencil: Pencil, trash: Trash2, check: CircleCheck, x: CircleX, login: LogIn, shield: ShieldAlert, "user-cog": UserCog };
const tones = { success: "border-emerald-100 bg-emerald-50 text-emerald-700", info: "border-sky-100 bg-sky-50 text-sky-700", danger: "border-rose-100 bg-rose-50 text-rose-700", warning: "border-amber-100 bg-amber-50 text-amber-700", neutral: "border-slate-200 bg-slate-50 text-slate-600" };

export function AuditEventList({ events }: { events: AuditListEvent[] }) {
  const [selected, setSelected] = useState<AuditDetail | null>(null);
  const groups = events.reduce<Array<{ date: string; items: AuditListEvent[] }>>((result, event) => { const group = result.at(-1); if (group?.date === event.dateGroup) group.items.push(event); else result.push({ date: event.dateGroup, items: [event] }); return result; }, []);
  return <><div className="overflow-hidden rounded-xl border border-gray-200 bg-white">{groups.map((group) => <section key={group.date}><h2 className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">{group.date}</h2>{group.items.map((event) => { const Icon = icons[event.icon]; return <article key={event.id} className="flex gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${tones[event.tone]}`}><Icon aria-hidden="true" className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4"><div className="min-w-0"><p className="break-words text-sm font-medium text-gray-900">{event.actor}</p><p className="mt-0.5 break-words text-sm text-gray-700">{event.event}{event.item ? <><span className="text-gray-400"> · </span><span className="font-medium">“{event.item}”</span></> : null}</p></div><time className="shrink-0 text-xs text-gray-400 sm:text-right" dateTime={event.time}>{event.shortTime}</time></div><button type="button" onClick={() => setSelected(event)} className="mt-2 text-sm font-medium text-green-700 hover:text-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">ดูรายละเอียด</button></div></article>; })}</section>)}</div><AuditDetailDialog detail={selected} onClose={() => setSelected(null)} /></>;
}
