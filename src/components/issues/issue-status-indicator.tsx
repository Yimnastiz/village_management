import { getIssueStatusMeta } from "@/lib/issues/status";
import { cn } from "@/lib/utils";

export const issueStageBadgeVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  OPEN: "warning", WAITING: "warning", PENDING: "warning", IN_PROGRESS: "info", RESOLVED: "success", CLOSED: "success", REJECTED: "danger",
};

interface IssueStatusIndicatorProps {
  stage: string;
  className?: string;
}

export function IssueStatusIndicator({ stage, className }: IssueStatusIndicatorProps) {
  const presentation = getIssueStatusMeta(stage);
  const Icon = presentation.icon;

  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium", presentation.className, className)}>
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      {presentation.label}
    </span>
  );
}
