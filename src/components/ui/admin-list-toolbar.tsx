"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Filter, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

type ExpandedPanel = "search" | "filter" | null;

type ToolbarChip = {
  label: string;
  href: string;
  active: boolean;
  isDefault?: boolean;
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
  /** Kept for older callers; URL state is now preserved from the current query string. */
  hiddenInputs?: Record<string, string>;
  suggestionTitles?: string[];
  groups?: ToolbarGroup[];
  actions?: ReactNode;
  compact?: boolean;
  sticky?: boolean;
  searchLabel?: string;
  filterLabel?: string;
}

/** Shared compact, URL-driven toolbar for admin registry lists. */
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
  searchLabel = "ค้นหา",
  filterLabel = "ตัวกรอง",
}: AdminListToolbarProps) {
  const [expandedPanel, setExpandedPanel] = useState<ExpandedPanel>(keyword ? "search" : null);
  const [searchValue, setSearchValue] = useState(keyword);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const currentSearchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const namespace = useMemo(() => `admin-list-${title.toLowerCase().replace(/\s+/g, "-")}`, [title]);
  const searchExpanded = expandedPanel === "search";
  const filterExpanded = expandedPanel === "filter";
  const activeFilterCount = groups.reduce(
    (count, group) => count + Number(group.options.some((option) => option.active && !option.isDefault && option.href !== clearHref)),
    0,
  );
  const legacyActiveFilterCount = groups.reduce(
    (count, group) => count + Number(group.options.some((option) => option.active && option.href !== (clearHref ?? searchAction))),
    0,
  );
  const searchPanelId = `${namespace}-search-panel`;
  const filterPanelId = `${namespace}-filter-panel`;
  const searchInputId = `${namespace}-search-input`;
  const suggestionsId = `${namespace}-search-suggestions`;

  useEffect(() => setSearchValue(keyword), [keyword]);
  useEffect(() => {
    if (searchExpanded) searchInputRef.current?.focus();
  }, [searchExpanded]);

  const applySearch = (value: string) => {
    const params = new URLSearchParams(currentSearchParams.toString());
    const nextKeyword = value.trim();
    if (nextKeyword) params.set("q", nextKeyword);
    else params.delete("q");
    params.delete("page");
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : (searchAction || pathname), { scroll: false }));
  };

  useEffect(() => {
    if (!compact) return;
    if (searchValue.trim() === keyword.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applySearch(searchValue), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // The URL parameters are intentionally read when the debounced update runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, searchValue, keyword]);

  const closeSearch = () => {
    setExpandedPanel(null);
    requestAnimationFrame(() => searchButtonRef.current?.focus());
  };
  const closeFilter = () => {
    setExpandedPanel(null);
    requestAnimationFrame(() => filterButtonRef.current?.focus());
  };
  const closeExpandedPanel = () => {
    if (searchExpanded) closeSearch();
    else if (filterExpanded) closeFilter();
  };

  if (!compact) {
    return (
      <div className={cn(
        "shrink-0",
        sticky
          ? "sticky top-0 z-30 -mx-4 space-y-3 border-y border-gray-200 bg-gray-50/95 px-4 py-3 shadow-sm backdrop-blur md:mx-0 md:space-y-4 md:border md:px-4"
          : "space-y-3 border border-gray-200 bg-gray-50 px-4 py-3 shadow-sm md:space-y-4",
      )}>
        <PageHeader title={title} description={description} actions={actions} />
        <FilterBar activeFilterCount={legacyActiveFilterCount}>
          <div className="flex flex-wrap items-center gap-2">
            <form action={searchAction} onSubmit={(event) => { event.preventDefault(); applySearch(searchValue); }} className="flex items-center gap-2">
              {Object.entries(hiddenInputs ?? {}).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
              <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100" aria-label={searchLabel} onClick={() => setExpandedPanel(searchExpanded ? null : "search")}>
                <Search className="h-4 w-4" />
              </button>
              {searchExpanded ? <div className="flex items-center gap-2">
                <input autoFocus name="q" list={suggestionTitles.length ? suggestionsId : undefined} placeholder={searchPlaceholder} value={searchValue} onChange={(event) => setSearchValue(event.target.value)} className="h-10 w-[min(14rem,calc(100vw-9rem))] rounded-lg border border-gray-300 px-3 text-sm outline-none ring-green-600 placeholder:text-gray-400 focus:ring-1" />
                <Button type="submit" size="sm">ค้นหา</Button>
              </div> : null}
            </form>
            {searchExpanded ? <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100" aria-label="ปิดค้นหา" onClick={closeSearch}><X className="h-4 w-4" /></button> : null}
            {suggestionTitles.length ? <datalist id={suggestionsId}>{suggestionTitles.map((value) => <option key={value} value={value} />)}</datalist> : null}
            {groups.map((group) => <div key={group.label} className="inline-flex items-center gap-2"><span className="ml-1 text-xs font-medium text-gray-500">{group.label}:</span>{group.options.map((option) => <Link key={`${group.label}-${option.label}`} href={option.href} className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", option.active ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>{option.label}</Link>)}</div>)}
            <Link href={clearHref ?? searchAction} className="inline-flex h-9 items-center rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-600 hover:bg-gray-100">ล้างตัวกรอง</Link>
          </div>
        </FilterBar>
      </div>
    );
  }

  return (
    <section
      className={cn(
        "shrink-0 space-y-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4",
      )}
      aria-label={`เครื่องมือ${title}`}
    >
      <header className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold tracking-tight text-gray-900 sm:text-xl">{title}</h1>
          {description ? <p className="mt-0.5 text-xs leading-5 text-gray-500 sm:text-sm">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>

      <div className="flex h-11 min-w-0 items-center gap-2" onKeyDown={(event) => {
        if (event.key === "Escape") closeExpandedPanel();
      }}>
        <button
          ref={searchButtonRef}
          type="button"
          aria-label={searchLabel}
          aria-expanded={searchExpanded}
          aria-controls={searchPanelId}
          onClick={() => searchExpanded ? closeSearch() : setExpandedPanel("search")}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </button>

        {searchExpanded ? (
          <form
            id={searchPanelId}
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              if (debounceRef.current) clearTimeout(debounceRef.current);
              applySearch(searchValue);
            }}
            className="flex min-w-0 flex-1 items-center gap-1.5"
          >
            <label htmlFor={searchInputId} className="sr-only">{searchLabel}</label>
            <input
              ref={searchInputRef}
              id={searchInputId}
              name="q"
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              list={suggestionTitles.length ? suggestionsId : undefined}
              placeholder={searchPlaceholder}
              className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none placeholder:text-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
            <button type="button" onClick={closeSearch} aria-label="ปิดช่องค้นหา" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="submit" className="sr-only">ค้นหา</button>
          </form>
        ) : <div id={searchPanelId} hidden />}

        <button
          ref={filterButtonRef}
          type="button"
          aria-label={filterLabel}
          aria-expanded={filterExpanded}
          aria-controls={filterPanelId}
          onClick={() => filterExpanded ? closeFilter() : setExpandedPanel("filter")}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
        >
          <Filter className="h-4 w-4" aria-hidden="true" />
          <span className="hidden md:inline">{filterLabel}</span>
          {activeFilterCount > 0 ? <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-green-600 px-1.5 text-xs font-semibold text-white">{activeFilterCount}</span> : null}
        </button>

        {filterExpanded ? (
          <div id={filterPanelId} className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain rounded-lg border border-gray-200 bg-white px-2 py-1.5 [scrollbar-width:thin]">
            <div className="flex w-max items-center gap-2 whitespace-nowrap">
              {groups.map((group) => <div key={group.label} className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500">{group.label}</span>
                {group.options.map((option) => <Link key={`${group.label}-${option.label}`} href={option.href} className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", option.active ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>{option.label}</Link>)}
              </div>)}
              {activeFilterCount > 0 && clearHref ? <Link href={clearHref} className="ml-1 rounded-full px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100">ล้างตัวกรอง</Link> : null}
            </div>
          </div>
        ) : <div id={filterPanelId} hidden />}
      </div>

      {suggestionTitles.length ? <datalist id={suggestionsId}>{suggestionTitles.map((value) => <option key={value} value={value} />)}</datalist> : null}
    </section>
  );
}
