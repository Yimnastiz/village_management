import { CircleCheck, CircleX, Clock3, Wrench, type LucideIcon } from "lucide-react";

export type IssueUserStatus = "PENDING" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";

export const ISSUE_STATUS_META: Record<IssueUserStatus, { label: string; icon: LucideIcon; className: string; badgeVariant: "default" | "info" | "success" | "warning" | "danger" }> = {
  PENDING: { label: "รอดำเนินการ", icon: Clock3, className: "text-slate-600", badgeVariant: "warning" },
  IN_PROGRESS: { label: "กำลังดำเนินการ", icon: Wrench, className: "text-blue-700", badgeVariant: "info" },
  RESOLVED: { label: "แก้ไขแล้ว", icon: CircleCheck, className: "text-green-700", badgeVariant: "success" },
  REJECTED: { label: "ปฏิเสธ", icon: CircleX, className: "text-red-700", badgeVariant: "danger" },
};

/** Maps persisted legacy stages to the four statuses shown to users. */
export function getIssueUserStatus(stage: string): IssueUserStatus {
  if (stage === "OPEN" || stage === "WAITING" || stage === "PENDING") return "PENDING";
  if (stage === "CLOSED" || stage === "RESOLVED") return "RESOLVED";
  if (stage === "IN_PROGRESS") return "IN_PROGRESS";
  return "REJECTED";
}

export function getIssueStatusMeta(stage: string) {
  return ISSUE_STATUS_META[getIssueUserStatus(stage)];
}

export const ISSUE_STAGE_LABELS: Record<string, string> = {
  OPEN: ISSUE_STATUS_META.PENDING.label,
  WAITING: ISSUE_STATUS_META.PENDING.label,
  PENDING: ISSUE_STATUS_META.PENDING.label,
  IN_PROGRESS: ISSUE_STATUS_META.IN_PROGRESS.label,
  RESOLVED: ISSUE_STATUS_META.RESOLVED.label,
  CLOSED: ISSUE_STATUS_META.RESOLVED.label,
  REJECTED: ISSUE_STATUS_META.REJECTED.label,
};

/** New writes use WAITING because it is the non-destructive persisted equivalent of PENDING. */
export const ISSUE_USER_STATUS_TO_STAGE = {
  PENDING: "WAITING",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  REJECTED: "REJECTED",
} as const;

export const ISSUE_ALLOWED_TRANSITIONS: Record<IssueUserStatus, IssueUserStatus[]> = {
  PENDING: ["IN_PROGRESS", "REJECTED"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: [],
  REJECTED: [],
};
