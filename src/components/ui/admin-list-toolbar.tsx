import type { ReactNode } from "react";
import Link from "next/link";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { cn } from "@/lib/utils";

type ToolbarChip = { label: string; href: string; active: boolean; isDefault?: boolean };
type ToolbarGroup = { label: string; options: ToolbarChip[] };

interface AdminListToolbarProps {
  title: string;
  description?: string;
  /** Retained for compatibility. Searches are always applied to the current route. */
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
  /** Route-specific controls rendered inside the shared filter panel. */
  extraFilters?: ReactNode;
  hideHeading?: boolean;
  /** Keeps search visible for this list without changing the shared default. */
  searchAlwaysVisible?: boolean;
}

/** Backward-compatible list adapter rendered through the shared admin toolbar. */
export function AdminListToolbar({
  title, description, clearHref, keyword, searchPlaceholder, suggestionTitles = [], groups = [], actions,
  sticky = false, searchLabel = "ค้นหา", extraFilters, hideHeading = false,
  searchAlwaysVisible = false,
}: AdminListToolbarProps) {
  const activeFilterCount = groups.reduce(
    (count, group) => count + Number(group.options.some((option, index) => option.active && !(option.isDefault ?? index === 0))),
    0,
  );
  const filters = groups.length ? <>
    {groups.map((group) => <div key={group.label} className="flex items-center gap-2">
      <span className="text-xs font-semibold text-gray-500">{group.label}</span>
      {group.options.map((option) => <Link key={`${group.label}-${option.label}`} href={option.href} className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", option.active ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>{option.label}</Link>)}
    </div>)}
    {activeFilterCount > 0 && clearHref ? <Link href={clearHref} className="ml-1 rounded-full px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100">ล้างตัวกรอง</Link> : null}
    {extraFilters}
  </> : extraFilters;

  return <AdminPageToolbar variant="list" title={title} description={description} actions={actions} sticky={sticky} hideHeading={hideHeading} search={{ keyword, placeholder: searchPlaceholder, label: searchLabel, suggestions: suggestionTitles }} filters={filters} activeFilterCount={activeFilterCount} searchAlwaysVisible={searchAlwaysVisible} />;
}
