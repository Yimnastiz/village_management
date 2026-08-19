import type { ReactNode } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { cn } from "@/lib/utils";

type ToolbarChip = { label: string; href: string; active: boolean; isDefault?: boolean };
export type ToolbarGroup = { label: string; options: ToolbarChip[] };

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
}

/** Compact group trigger. Its selected option is marked in the downward menu. */
export function AdminFilterDropdown({ group }: { group: ToolbarGroup }) {
  const selectedOption = group.options.find((option) => option.active) ?? group.options[0];

  return (
    <details className="group relative shrink-0">
      <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 [&::-webkit-details-marker]:hidden">
        <span>{group.label}</span>
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="absolute left-0 top-full z-30 mt-1 min-w-48 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
        {group.options.map((option) => (
          <Link key={`${group.label}-${option.label}`} href={option.href} aria-current={option.active ? "true" : undefined} className={cn("flex min-h-9 items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:bg-green-50", option.active ? "bg-green-50 font-medium text-green-800" : "text-gray-700")}>
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">{option.active ? <Check className="h-4 w-4" aria-hidden="true" /> : null}</span>
            <span>{option.label}</span>
          </Link>
        ))}
      </div>
      <span className="sr-only">Selected: {selectedOption?.label}</span>
    </details>
  );
}

/** Backward-compatible list adapter rendered through the shared admin toolbar. */
export function AdminListToolbar({
  title, description, clearHref, keyword, searchPlaceholder, suggestionTitles = [], groups = [], actions,
  sticky = false, searchLabel = "ค้นหา", extraFilters, hideHeading = false,
  searchAlwaysVisible = true, filtersInlineWithSearch = false,
}: AdminListToolbarProps) {
  const activeFilterCount = groups.reduce(
    (count, group) => count + Number(group.options.some((option, index) => option.active && !(option.isDefault ?? index === 0))),
    0,
  );
  const groupControls = hideHeading
    ? groups.map((group) => <div key={group.label} className="flex items-center gap-2"><span className="text-xs font-semibold text-gray-500">{group.label}</span>{group.options.map((option) => <Link key={`${group.label}-${option.label}`} href={option.href} className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", option.active ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>{option.label}</Link>)}</div>)
    : groups.map((group) => <AdminFilterDropdown key={group.label} group={group} />);
  const filters = groups.length ? <>
    {groupControls}
    {activeFilterCount > 0 && clearHref ? <Link href={clearHref} className="inline-flex h-9 items-center rounded-md px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500">ล้างตัวกรอง</Link> : null}
    {extraFilters}
  </> : extraFilters;

  return <AdminPageToolbar variant="list" title={title} description={description} actions={actions} sticky={sticky} hideHeading={hideHeading} search={{ keyword, placeholder: searchPlaceholder, label: searchLabel, suggestions: suggestionTitles }} filters={filters} activeFilterCount={activeFilterCount} searchAlwaysVisible={searchAlwaysVisible} filtersInlineWithSearch={filtersInlineWithSearch} />;
}
