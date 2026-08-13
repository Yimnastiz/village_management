"use client";

import { ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";

type ToolbarChip = {
  label: string;
  href: string;
  active: boolean;
};

type ToolbarGroup = {
  label: string;
  options: ToolbarChip[];
};

interface AdminListToolbarProps {
  title: string;
  description?: string;
  searchAction: string;
  clearHref?: string;
  keyword: string;
  searchPlaceholder: string;
  hiddenInputs?: Record<string, string>;
  suggestionTitles?: string[];
  groups?: ToolbarGroup[];
  actions?: ReactNode;
  compact?: boolean;
  sticky?: boolean;
}

export function AdminListToolbar({
  title,
  description,
  searchAction,
  clearHref,
  keyword,
  searchPlaceholder,
  hiddenInputs,
  suggestionTitles = [],
  groups = [],
  actions,
  compact = false,
  sticky = true,
}: AdminListToolbarProps) {
  const [searchOpen, setSearchOpen] = useState(Boolean(keyword));
  const datalistId = useMemo(
    () => `${title.toLowerCase().replace(/\s+/g, "-")}-suggestions`,
    [title],
  );

  return (
    <div className={cn(
      "shrink-0",
      compact
        ? sticky
          ? "sticky top-[var(--app-sticky-top,4rem)] z-30 -mt-2 space-y-2 rounded-xl border border-gray-200 bg-white/95 p-3 shadow-sm backdrop-blur transition-[top] duration-[var(--app-topbar-motion,180ms)] supports-[backdrop-filter]:bg-white/90 sm:-mt-3 sm:p-4"
          : "space-y-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4"
        : sticky
          ? "sticky top-0 z-30 -mx-4 space-y-3 border-y border-gray-200 bg-gray-50/95 px-4 py-3 shadow-sm backdrop-blur md:mx-0 md:space-y-4 md:border md:px-4"
          : "space-y-3 border border-gray-200 bg-gray-50 px-4 py-3 shadow-sm md:space-y-4",
    )}>
      <PageHeader title={title} description={description} actions={actions} className={compact ? "gap-2 sm:items-center [&_h1]:text-lg [&_h1]:sm:text-xl [&_p]:mt-0.5 [&_p]:leading-5" : undefined} />

      <div>
      <FilterBar activeFilterCount={groups.reduce((count, group) => count + Number(group.options.some((option) => option.active && option.href !== (clearHref ?? searchAction))), 0)}>
        <div className="flex flex-wrap items-center gap-2">
          <form action={searchAction} className="flex items-center gap-2">
            {Object.entries(hiddenInputs ?? {}).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}

            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
              aria-label="ค้นหา"
              onClick={() => setSearchOpen((currentValue) => !currentValue)}
            >
              <Search className="h-4 w-4" />
            </button>

            {searchOpen && (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  name="q"
                  list={suggestionTitles.length > 0 ? datalistId : undefined}
                  placeholder={searchPlaceholder}
                  defaultValue={keyword}
                  className="h-10 w-[min(14rem,calc(100vw-9rem))] rounded-lg border border-gray-300 px-3 text-sm outline-none ring-green-600 placeholder:text-gray-400 focus:ring-1"
                />
                <Button type="submit" size="sm">ค้นหา</Button>
              </div>
            )}
          </form>

          {searchOpen && (
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100"
              aria-label="ปิดค้นหา"
              onClick={() => setSearchOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {suggestionTitles.length > 0 && (
            <datalist id={datalistId}>
              {suggestionTitles.map((titleValue) => (
                <option key={titleValue} value={titleValue} />
              ))}
            </datalist>
          )}

          {groups.map((group) => (
            <div key={group.label} className="inline-flex items-center gap-2">
              <span className="ml-1 text-xs font-medium text-gray-500">{group.label}:</span>
              {group.options.map((option) => (
                <Link
                  key={`${group.label}-${option.label}`}
                  href={option.href}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    option.active
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                  )}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          ))}

          <Link
            href={clearHref ?? searchAction}
            className="inline-flex h-9 items-center rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            ล้างตัวกรอง
          </Link>
        </div>
      </FilterBar>
      </div>
    </div>
  );
}
