import { formatThaiDateTime } from "@/lib/utils";
import { Clock3, FileText, MessageCircle, type LucideIcon } from "lucide-react";
import { getIssueStatusMeta } from "@/lib/issues/status";

interface TimelineItem { id: string; action: string; description?: string | null; actorId?: string | null; actorName?: string | null; actorRoleLabel?: string | null; metadata?: unknown; createdAt: Date | string; }
interface TimelineProps { items: TimelineItem[]; }
type Change = { field?: string; label: string; before?: string | null; after?: string | null; summary?: string; beforeText?: string; afterText?: string; addedCount?: number; removedCount?: number; reordered?: boolean };
type Presentation = { title: string; icon: LucideIcon; className: string; status?: { from?: string; to?: string } };

function recordFor(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" ? value as Record<string, unknown> : null; }
function stringFor(value: unknown) { return typeof value === "string" ? value : undefined; }
function countFor(value: unknown) { return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : 0; }

function changesFor(metadata: Record<string, unknown> | null): Change[] {
  if (!Array.isArray(metadata?.changes)) return [];
  return metadata.changes.flatMap((value) => {
    const change = recordFor(value);
    const label = stringFor(change?.label);
    if (!label) return [];
    const before = stringFor(change?.before) ?? (change?.before === null ? null : undefined);
    const after = stringFor(change?.after) ?? (change?.after === null ? null : undefined);
    const summary = stringFor(change?.summary);
    const beforeText = stringFor(change?.beforeText);
    const afterText = stringFor(change?.afterText);
    const addedCount = countFor(change?.addedCount);
    const removedCount = countFor(change?.removedCount);
    const reordered = change?.reordered === true;
    if (before === undefined && after === undefined && !summary && !beforeText && !afterText && !addedCount && !removedCount && !reordered) return [];
    return [{ field: stringFor(change?.field), label, before, after, summary, beforeText, afterText, addedCount, removedCount, reordered }];
  });
}

function presentationFor(item: TimelineItem): Presentation {
  const metadata = recordFor(item.metadata);
  const eventType = stringFor(metadata?.eventType);
  const oldAction = item.action;
  if (eventType === "ISSUE_CREATED" || oldAction === "สร้างคำร้อง" || oldAction === "แจ้งปัญหา") return { title: "สร้างคำร้อง", icon: FileText, className: "text-slate-600" };
  if (eventType === "ISSUE_EDITED" || oldAction === "แก้ไขคำร้อง") return { title: "แก้ไขคำร้อง", icon: FileText, className: "text-slate-600" };
  if (eventType === "COMMENT" || oldAction === "แสดงความคิดเห็น" || oldAction === "COMMENT") return { title: "แสดงความคิดเห็น", icon: MessageCircle, className: "text-slate-600" };
  if (eventType === "PROGRESS" || oldAction === "เพิ่มความคืบหน้า" || oldAction === "อัปเดตความคืบหน้า") return { title: "เพิ่มความคืบหน้า", icon: Clock3, className: "text-slate-600" };
  if (eventType === "STATUS_CHANGE" || oldAction === "อัปเดตสถานะ" || oldAction === "เปลี่ยนสถานะ") {
    const from = stringFor(metadata?.fromStatus);
    const to = stringFor(metadata?.toStatus) ?? stringFor(metadata?.stage);
    const status = getIssueStatusMeta(to ?? "");
    return { title: "อัปเดตสถานะ", icon: status.icon, className: status.className, status: { from, to } };
  }
  return { title: oldAction || "กิจกรรมคำร้อง", icon: Clock3, className: "text-slate-600" };
}

function statusText(status?: { from?: string; to?: string }) {
  if (!status?.to) return null;
  const fromLabel = status.from ? getIssueStatusMeta(status.from).label : null;
  const toLabel = getIssueStatusMeta(status.to).label;
  return fromLabel ? `สถานะ: ${fromLabel} → ${toLabel}` : `สถานะ: ${toLabel}`;
}

function imageSummary(change: Change) {
  return [change.addedCount ? `เพิ่ม ${change.addedCount} รูป` : null, change.removedCount ? `ลบ ${change.removedCount} รูป` : null, change.reordered ? "จัดลำดับรูปภาพใหม่" : null].filter(Boolean).join(" · ");
}

export function Timeline({ items }: TimelineProps) { return <ol className="relative ml-3 border-l border-gray-200">{items.map((item, index) => <TimelineRow key={item.id} item={item} last={index === items.length - 1} presentation={presentationFor(item)} />)}</ol>; }

function TimelineRow({ item, last, presentation }: { item: TimelineItem; last: boolean; presentation: Presentation }) {
  const Icon = presentation.icon;
  const changes = changesFor(recordFor(item.metadata));
  const status = statusText(presentation.status);
  return <li className={`relative ml-5 ${last ? "" : "pb-6"}`}>
    <span className={`absolute -left-8 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-4 ring-white ${presentation.className}`}><Icon aria-hidden="true" className="h-5 w-5" /></span>
    <p className="break-words text-sm font-medium text-gray-900">{presentation.title}</p>
    {status ? <p className="mt-1 text-sm text-gray-600">{status}</p> : null}
    <time className="mt-1 block text-xs text-gray-500">{formatThaiDateTime(item.createdAt)}</time>
    <p className="mt-1 text-xs text-gray-500">{item.actorId ? `โดย ${item.actorName ?? "ไม่พบข้อมูลผู้ดำเนินการ"}${item.actorRoleLabel ? ` (${item.actorRoleLabel})` : ""}` : "โดยระบบ"}</p>
    {item.description ? <p className="mt-2 break-words whitespace-pre-wrap text-sm text-gray-600">{item.description}</p> : null}
    {changes.length > 0 ? <details className="mt-2 text-sm text-gray-600"><summary className="cursor-pointer text-green-700 hover:text-green-800">ดูรายละเอียดการเปลี่ยนแปลง ▾</summary><div className="mt-2 space-y-3 border-l border-gray-200 pl-3">{changes.map((change, index) => <ChangeDetail key={`${change.label}-${index}`} change={change} />)}</div></details> : null}
  </li>;
}

function ChangeDetail({ change }: { change: Change }) {
  const images = change.field === "images" ? imageSummary(change) : "";
  return <div><p className="font-medium text-gray-800">{change.label}</p>{change.before !== undefined || change.after !== undefined ? <p className="mt-0.5 whitespace-pre-wrap">{change.before ?? "ไม่ได้ระบุ"} → {change.after ?? "ไม่ได้ระบุ"}</p> : null}{change.summary ? <p className="mt-0.5">{change.summary}</p> : null}{images ? <p className="mt-0.5">{images}</p> : null}{change.beforeText && change.afterText ? <details className="mt-1"><summary className="cursor-pointer text-xs text-gray-500">ดูข้อความเดิมและใหม่</summary><p className="mt-1 whitespace-pre-wrap text-xs">เดิม: {change.beforeText}</p><p className="mt-1 whitespace-pre-wrap text-xs">ใหม่: {change.afterText}</p></details> : null}</div>;
}
