import type { Prisma, VillageMembershipRole } from "@prisma/client";
import { MEMBERSHIP_ROLE_LABELS } from "@/lib/constants";
import { formatThaiDateTime } from "@/lib/utils";

type TimelineEntry = {
  id: string;
  actorId: string | null;
  action: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  actor: {
    name: string | null;
    email?: string | null;
    memberships: Array<{ villageId?: string; role: VillageMembershipRole }>;
  } | null;
};

type Props = {
  entries: TimelineEntry[];
  villageId: string;
  /** Resident detail retains its existing "คุณ" wording. Admin omits this to show every real actor. */
  viewerId?: string;
};

const actionLabels: Record<string, string> = {
  CREATED: "ส่งคำขอนัดหมาย",
  UPDATED: "แก้ไขนัดหมาย",
  TIME_SUGGESTED: "เสนอวันเวลา",
  APPROVED: "ยืนยันนัดหมาย",
  REJECTED: "ปฏิเสธคำขอนัดหมาย",
  CANCELLED: "ยกเลิกนัดหมาย",
  TIME_CHANGE_REQUESTED: "ขอเปลี่ยนเวลา",
};

function metadataOf(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, Prisma.JsonValue> : {};
}

function stringValue(metadata: Record<string, Prisma.JsonValue>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function changeValue(value: Prisma.JsonValue | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, Prisma.JsonValue>;
  if (!("from" in record) && !("to" in record)) return null;
  const display = (item: Prisma.JsonValue | undefined) => item === null || item === undefined || item === "" ? "-" : String(item);
  return { from: display(record.from), to: display(record.to) };
}

function changeDetails(metadata: Record<string, Prisma.JsonValue>) {
  const changes = metadata.changes;
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return [];
  const values = changes as Record<string, Prisma.JsonValue>;
  const labels: Record<string, string> = {
    title: "เรื่อง",
    preferredTime: "ช่วงเวลาที่สะดวก",
    slotDate: "วันนัดหมาย",
    slotTime: "เวลา",
    description: "รายละเอียด",
  };
  const details = Object.entries(labels).flatMap(([key, label]) => {
    const value = changeValue(values[key]);
    return value ? [{ label, text: `${value.from} → ${value.to}` }] : [];
  });
  if (values.descriptionChanged === true && !details.some((detail) => detail.label === "รายละเอียด")) {
    details.push({ label: "รายละเอียด", text: "มีการแก้ไขรายละเอียด" });
  }
  return details;
}

function actorLabel(entry: TimelineEntry, villageId: string, viewerId?: string) {
  if (!entry.actorId) return "ระบบ";
  if (viewerId && entry.actorId === viewerId) return "คุณ";
  const membership = entry.actor?.memberships.find((item) => !item.villageId || item.villageId === villageId);
  const role = membership ? MEMBERSHIP_ROLE_LABELS[membership.role] : null;
  const name = entry.actor?.name || entry.actor?.email || "ไม่พบข้อมูลผู้ดำเนินการ";
  return role ? `${name} (${role})` : name;
}

export function AppointmentTimeline({ entries, villageId, viewerId }: Props) {
  if (!entries.length) return <p className="mt-4 text-sm text-gray-500">ยังไม่มีประวัติการดำเนินการ</p>;

  return <ol className="mt-4">
    {entries.map((entry, index) => {
      const metadata = metadataOf(entry.metadata);
      const preferredTime = stringValue(metadata, "preferredTime");
      const reason = stringValue(metadata, "reason");
      const slotTime = stringValue(metadata, "slotTime");
      const slotDate = stringValue(metadata, "slotDate");
      const parsedSlotDate = slotDate ? new Date(slotDate) : null;
      const slotDateLabel = parsedSlotDate && !Number.isNaN(parsedSlotDate.getTime()) ? formatThaiDateTime(parsedSlotDate).replace(/ เวลา .*$/, "") : null;
      const details = changeDetails(metadata);
      return <li key={entry.id} className="relative flex gap-3">
        <div className="flex w-3 flex-col items-center">
          <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-green-600" />
          {index < entries.length - 1 ? <span className="mt-1 w-px flex-1 bg-gray-200" /> : null}
        </div>
        <div className="min-w-0 flex-1 pb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="font-medium text-gray-900">{(actionLabels[entry.action] ?? entry.action) || "อัปเดตนัดหมาย"}</p>
            <time className="text-xs text-gray-400">{formatThaiDateTime(entry.createdAt)}</time>
          </div>
          <p className="mt-1 text-sm text-gray-500">{actorLabel(entry, villageId, viewerId)}</p>
          {(preferredTime || reason || slotTime) ? <div className="mt-2 text-sm text-gray-700">
            {preferredTime ? <p>ช่วงเวลาที่สะดวก: {preferredTime}</p> : null}
            {reason ? <p>เหตุผล: {reason}</p> : null}
            {slotTime ? <p>{slotDateLabel ? `${slotDateLabel} เวลา ` : ""}{slotTime.split("-")[0]}</p> : null}
          </div> : null}
          {details.length ? <details className="mt-2 text-sm text-gray-600">
            <summary className="cursor-pointer font-medium text-green-700">ดูรายละเอียดการเปลี่ยนแปลง</summary>
            <div className="mt-2 space-y-1 pl-1">{details.map((detail) => <p key={detail.label}>{detail.label}: {detail.text}</p>)}</div>
          </details> : null}
        </div>
      </li>;
    })}
  </ol>;
}
