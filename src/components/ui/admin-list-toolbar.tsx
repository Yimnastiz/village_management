"use client";

import { ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  keyword: string;
  searchPlaceholder: string;
  hiddenInputs?: Record<string, string>;
  suggestionTitles?: string[];
  groups?: ToolbarGroup[];
  actions?: ReactNode;
}

export function AdminListToolbar({
  title,
  description,
  searchAction,
  keyword,
  searchPlaceholder,
  hiddenInputs,
  suggestionTitles = [],
  groups = [],
  actions,
}: AdminListToolbarProps) {
  const [searchOpen, setSearchOpen] = useState(Boolean(keyword));
  const datalistId = useMemo(
    () => `${title.toLowerCase().replace(/\s+/g, "-")}-suggestions`,
    [title],
  );

  return (
    <div className="sticky top-16 z-30 -mx-6 border-b border-gray-200 bg-gray-50/95 px-6 pb-4 pt-3 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
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
                  className="h-9 w-56 rounded-lg border border-gray-300 px-3 text-sm outline-none ring-green-600 placeholder:text-gray-400 focus:ring-1"
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
        </div>
      </div>
    </div>
  );
}