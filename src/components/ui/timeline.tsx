import { formatThaiDateTime } from "@/lib/utils";
import { Clock3, FileText, MessageCircle, type LucideIcon } from "lucide-react";
import { getIssueStatusMeta } from "@/lib/issues/status";

interface TimelineItem { id: string; action: string; description?: string | null; actorId?: string | null; actorName?: string | null; actorRoleLabel?: string | null; metadata?: unknown; createdAt: Date | string; }
interface TimelineProps { items: TimelineItem[]; }
type Change = { label: string; before: string | null; after: string | null };
type Presentation = { title: string; icon: LucideIcon; className: string; statusLabel?: string };

function recordFor(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" ? value as Record<string, unknown> : null; }

function changesFor(metadata: Record<string, unknown> | null): Change[] {
  if (!Array.isArray(metadata?.changes)) return [];
  return metadata.changes.flatMap((value) => {
    const change = recordFor(value);
    if (!change || typeof change.label !== "string") return [];
    const before = typeof change.before === "string" ? change.before : change.before === null ? null : undefined;
    const after = typeof change.after === "string" ? change.after : change.after === null ? null : undefined;
    return before === undefined || after === undefined ? [] : [{ label: change.label, before, after }];
  });
}

function presentationFor(item: TimelineItem): Presentation {
  const metadata = recordFor(item.metadata);
  const eventType = typeof metadata?.eventType === "string" ? metadata.eventType : null;
  const stage = typeof metadata?.stage === "string" ? metadata.stage : null;
  if (eventType === "ISSUE_CREATED" || item.action === "แจ้งปัญหา") return { title: "สร้างคำร้อง", icon: FileText, className: "text-slate-600" };
  if (eventType === "ISSUE_EDITED" || item.action === "แก้ไขคำร้อง") return { title: "แก้ไขคำร้อง", icon: FileText, className: "text-slate-600" };
  if (eventType === "COMMENT" || item.action === "COMMENT") return { title: "แสดงความคิดเห็น", icon: MessageCircle, className: "text-slate-600" };
  if (eventType === "STATUS_CHANGE" || item.action === "เปลี่ยนสถานะ") {
    const status = getIssueStatusMeta(stage ?? "");
    return { title: "อัปเดตสถานะ", icon: status.icon, className: status.className, statusLabel: status.label };
  }
  return { title: "เพิ่มความคืบหน้า", icon: Clock3, className: "text-slate-600" };
}

export function Timeline({ items }: TimelineProps) { return <ol className="relative ml-3 border-l border-gray-200">{items.map((item, index) => <TimelineRow key={item.id} item={item} last={index === items.length - 1} presentation={presentationFor(item)} />)}</ol>; }

function TimelineRow({ item, last, presentation }: { item: TimelineItem; last: boolean; presentation: Presentation }) {
  const Icon = presentation.icon;
  const changes = changesFor(recordFor(item.metadata));
  return <li className={`relative ml-5 ${last ? "" : "pb-6"}`}>
    <span className={`absolute -left-8 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-4 ring-white ${presentation.className}`}><Icon aria-hidden="true" className="h-5 w-5" /></span>
    <p className="break-words text-sm font-medium text-gray-900">{presentation.title}</p>
    {presentation.statusLabel ? <p className="mt-1 text-sm text-gray-600">สถานะ: {presentation.statusLabel}</p> : null}
    <time className="mt-1 block text-xs text-gray-500">{formatThaiDateTime(item.createdAt)}</time>
    <p className="mt-1 text-xs text-gray-500">{item.actorId ? `โดย ${item.actorName ?? "ไม่พบข้อมูลผู้ดำเนินการ"}${item.actorRoleLabel ? ` (${item.actorRoleLabel})` : ""}` : "โดยระบบ"}</p>
    {item.description ? <p className="mt-2 break-words whitespace-pre-wrap text-sm text-gray-600">{item.description}</p> : null}
    {changes.length > 0 ? <details className="mt-2 text-sm text-gray-600"><summary className="cursor-pointer text-green-700 hover:text-green-800">ดูรายละเอียดการเปลี่ยนแปลง ▾</summary><ul className="mt-2 space-y-1 border-l border-gray-200 pl-3">{changes.map((change) => <li key={change.label}>{change.before !== null && change.after !== null ? `${change.label}: ${change.before} → ${change.after}` : change.after !== null ? `${change.label}: ${change.after}` : change.label}</li>)}</ul></details> : null}
  </li>;
}
