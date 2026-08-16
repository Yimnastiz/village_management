import { formatThaiDateTime } from "@/lib/utils";
import { Clock3, FileText, MessageCircle, type LucideIcon } from "lucide-react";
import { getIssueStatusMeta } from "@/lib/issues/status";

interface TimelineItem {
  id: string;
  action: string;
  description?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  actorRoleLabel?: string | null;
  metadata?: unknown;
  createdAt: Date | string;
}

interface TimelineProps {
  items: TimelineItem[];
}

export function Timeline({ items }: TimelineProps) {
  const presentationFor = (item: TimelineItem): { title: string; icon: LucideIcon; className: string } => {
    const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata as Record<string, unknown> : null;
    const stage = typeof metadata?.stage === "string" ? metadata.stage : null;
    if (stage) {
      const meta = getIssueStatusMeta(stage);
      return { title: meta.label, icon: meta.icon, className: meta.className };
    }
    if (item.action === "แจ้งปัญหา") return { title: "รอดำเนินการ", icon: Clock3, className: "text-slate-600" };
    if (item.action === "COMMENT") return { title: "ความคิดเห็น", icon: MessageCircle, className: "text-slate-600" };
    return { title: "อัปเดตความคืบหน้า", icon: FileText, className: "text-slate-600" };
  };
  return (
    <ol className="relative ml-3 border-l border-gray-200">
      {items.map((item, index) => (
        <TimelineRow key={item.id} item={item} last={index === items.length - 1} presentation={presentationFor(item)} />
      ))}
    </ol>
  );
}

function TimelineRow({ item, last, presentation }: { item: TimelineItem; last: boolean; presentation: { title: string; icon: LucideIcon; className: string } }) {
  const Icon = presentation.icon;
  return (
    <li className={`relative ml-5 ${last ? "" : "pb-6"}`}>
      <span className={`absolute -left-8 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-4 ring-white ${presentation.className}`}>
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <p className="break-words text-sm font-medium text-gray-900">{presentation.title}</p>
      <time className="mt-1 block text-xs text-gray-500">{formatThaiDateTime(item.createdAt)}</time>
      <p className="mt-1 text-xs text-gray-500">
        {item.actorId
          ? `โดย ${item.actorName ?? "ไม่พบข้อมูลผู้ดำเนินการ"}${item.actorRoleLabel ? ` (${item.actorRoleLabel})` : ""}`
          : "โดยระบบ"}
      </p>
          {item.description && (
        <p className="mt-2 break-words whitespace-pre-wrap text-sm text-gray-600">{item.description}</p>
          )}
    </li>
  );
}
