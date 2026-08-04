"use client";

import { useId, useState } from "react";
import { Filter } from "lucide-react";
import { cn } from "@/lib/utils";

type FilterBarProps = {
  children: React.ReactNode;
  className?: string;
  activeFilterCount?: number;
  defaultOpen?: boolean;
  label?: string;
};

/** Shared compact filter trigger and collapsible panel used across every role. */
export function FilterBar({ children, className, activeFilterCount = 0, defaultOpen = false, label = "ตัวกรอง" }: FilterBarProps) {
  const panelId = useId();
  const [open, setOpen] = useState(defaultOpen || activeFilterCount > 0);

  return (
    <section aria-label={label} className={cn("space-y-2", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
      >
        <Filter className="h-4 w-4" aria-hidden="true" />
        {label}
        {activeFilterCount > 0 ? <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-green-600 px-1.5 text-xs font-semibold text-white">{activeFilterCount}</span> : null}
      </button>
      {open ? (
        <div id={panelId} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}
