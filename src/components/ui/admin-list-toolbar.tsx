"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { AdminPageToolbar, useAdminFilterDropdowns } from "@/components/ui/admin-page-toolbar";
import { cn } from "@/lib/utils";

type ToolbarChip = { label: string; href: string; active: boolean; isDefault?: boolean };
export type ToolbarGroup = { label: string; options: ToolbarChip[]; countsAsFilter?: boolean };

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
  searchLabel?: string;
  filterLabel?: string;
  extraFilters?: ReactNode;
  hideHeading?: boolean;
  searchAlwaysVisible?: boolean;
  filtersInlineWithSearch?: boolean;
  className?: string;
}

/** Compact single-select dropdown controlled by the shared toolbar. */
export function AdminFilterDropdown({ group }: { group: ToolbarGroup }) {
  const toolbarDropdowns = useAdminFilterDropdowns();
  const [localOpen, setLocalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const selectedOption = group.options.find((option) => option.active) ?? group.options[0];
  const isOpen = toolbarDropdowns ? toolbarDropdowns.openDropdown === group.label : localOpen;
  const setOpen = (open: boolean) => {
    if (toolbarDropdowns) toolbarDropdowns.setOpenDropdown(open ? group.label : null);
    else setLocalOpen(open);
  };

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsidePress = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsidePress);
    return () => document.removeEventListener("mousedown", closeOnOutsidePress);
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative shrink-0">
      <button type="button" aria-expanded={isOpen} aria-controls={menuId} onClick={() => setOpen(!isOpen)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500">
        <span>{group.label}: {selectedOption?.label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} aria-hidden="true" />
      </button>
      {isOpen ? <div id={menuId} className="absolute left-0 top-full z-50 mt-1 w-max min-w-36 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-gray-200 bg-white py-0.5 shadow-lg sm:left-auto sm:right-0">
        {group.options.map((option) => (
          <Link key={`${group.label}-${option.label}`} href={option.href} aria-current={option.active ? "true" : undefined} onClick={() => { setOpen(false); toolbarDropdowns?.keepFiltersOpen(); }} className={cn("flex min-h-10 items-center justify-between gap-4 px-3 py-2 text-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:bg-green-50 sm:min-h-8 sm:py-1.5", option.active ? "bg-green-50 font-medium text-green-800" : "text-gray-700")}>
            <span>{option.label}</span>
            {option.active ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
          </Link>
        ))}
      </div> : null}
    </div>
  );
}

/** Backward-compatible list adapter rendered through the shared admin toolbar. */
export function AdminListToolbar({
  title, description, clearHref, keyword, searchPlaceholder, suggestionTitles = [], groups = [], actions,
  sticky = false, searchLabel = "ค้นหา", extraFilters, hideHeading = false,
  searchAlwaysVisible = true, filtersInlineWithSearch = false, className,
}: AdminListToolbarProps) {
  const activeFilterCount = groups.reduce(
    (count, group) => count + Number((group.countsAsFilter ?? !["เรียง", "เรียงลำดับ"].includes(group.label)) && group.options.some((option, index) => option.active && !(option.isDefault ?? index === 0))),
    0,
  );
  const clearFiltersHref = (() => {
    if (!clearHref) return undefined;
    const [path, query = ""] = clearHref.split("?");
    const params = new URLSearchParams(query);
    if (keyword.trim() && !params.has("q")) params.set("q", keyword.trim());
    const normalizedQuery = params.toString();
    return normalizedQuery ? `${path}?${normalizedQuery}` : path;
  })();
  const groupControls = groups.map((group) => <AdminFilterDropdown key={group.label} group={group} />);
  const filters = groups.length ? <>
    {groupControls}
    {activeFilterCount > 0 && clearFiltersHref ? <Link href={clearFiltersHref} className="inline-flex h-9 items-center rounded-md px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500">ล้างตัวกรอง</Link> : null}
    {extraFilters}
  </> : extraFilters;

  return <AdminPageToolbar variant="list" title={title} description={description} actions={actions} sticky={sticky} hideHeading={hideHeading} className={className} search={{ keyword, placeholder: searchPlaceholder, label: searchLabel, suggestions: suggestionTitles }} filters={filters} activeFilterCount={activeFilterCount} searchAlwaysVisible={searchAlwaysVisible} filtersInlineWithSearch={filtersInlineWithSearch} />;
}
