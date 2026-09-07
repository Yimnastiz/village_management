import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type TooltipProps = { label: string; children: ReactNode; className?: string };

export function Tooltip({ label, children, className }: TooltipProps) {
  const tooltipId = `tooltip-${label.replace(/\s+/g, "-")}`;

  return <span className={cn("group relative inline-flex", className)}>
    <span aria-describedby={tooltipId}>{children}</span>
    <span id={tooltipId} role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">{label}</span>
  </span>;
}
