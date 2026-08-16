import { CircleCheck, CircleX, Clock3, Wrench } from "lucide-react";
import { ISSUE_STAGE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const issueStageBadgeVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  WAITING: "warning",
  RESOLVED: "success",
  CLOSED: "default",
  REJECTED: "danger",
};

const statusPresentation = {
  OPEN: { icon: Clock3, className: "text-amber-700" },
  IN_PROGRESS: { icon: Wrench, className: "text-blue-700" },
  WAITING: { icon: Clock3, className: "text-amber-700" },
  RESOLVED: { icon: CircleCheck, className: "text-green-700" },
  CLOSED: { icon: CircleCheck, className: "text-gray-600" },
  REJECTED: { icon: CircleX, className: "text-red-700" },
} as const;

interface IssueStatusIndicatorProps {
  stage: string;
  className?: string;
}

export function IssueStatusIndicator({ stage, className }: IssueStatusIndicatorProps) {
  const presentation = statusPresentation[stage as keyof typeof statusPresentation];
  const Icon = presentation?.icon ?? Clock3;

  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium", presentation?.className ?? "text-gray-600", className)}>
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      {ISSUE_STAGE_LABELS[stage] ?? stage}
    </span>
  );
}
