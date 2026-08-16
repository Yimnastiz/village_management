export const ISSUE_PRIORITY_META = {
  URGENT: {
    label: "เร่งด่วน",
    stripeClass: "bg-red-700",
    badgeClass: "bg-red-100 text-red-800 ring-1 ring-inset ring-red-200",
  },
  HIGH: {
    label: "สูง",
    stripeClass: "bg-orange-500",
    badgeClass: "bg-orange-100 text-orange-800 ring-1 ring-inset ring-orange-200",
  },
  MEDIUM: {
    label: "ปานกลาง",
    stripeClass: "bg-yellow-400",
    badgeClass: "bg-yellow-100 text-yellow-900 ring-1 ring-inset ring-yellow-200",
  },
  LOW: {
    label: "ต่ำ",
    stripeClass: "bg-slate-400",
    badgeClass: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
  },
} as const;

export type IssuePriorityMeta = {
  label: string;
  stripeClass: string;
  badgeClass: string;
};

const fallbackPriorityMeta: IssuePriorityMeta = {
  label: "ไม่ระบุ",
  stripeClass: "bg-slate-300",
  badgeClass: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
};

export function getIssuePriorityMeta(priority: string | null | undefined): IssuePriorityMeta {
  return ISSUE_PRIORITY_META[priority as keyof typeof ISSUE_PRIORITY_META] ?? fallbackPriorityMeta;
}

export const ISSUE_PRIORITY_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(ISSUE_PRIORITY_META).map(([priority, meta]) => [priority, meta.label])
);
