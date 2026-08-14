"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Filter, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";

type ExpandedPanel = "search" | "filter" | null;

type NewsToolbarProps = {
  namespace: "admin-news" | "resident-news";
  title: string;
  description?: string;
  actions?: ReactNode;
  searchAction: string;
  keyword: string;
  searchPlaceholder: string;
  hiddenInputs?: Record<string, string>;
  suggestionTitles?: string[];
  activeFilterCount?: number;
  filters: ReactNode;
};

export function NewsToolbar({
  namespace,
  title,
  description,
  actions,
  searchAction,
  keyword,
  searchPlaceholder,
  hiddenInputs,
  suggestionTitles = [],
  activeFilterCount = 0,
  filters,
}: NewsToolbarProps) {
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
  const searchPanelId = `${namespace}-search-panel`;
  const filterPanelId = `${namespace}-filter-panel`;
  const suggestionsId = `${namespace}-search-suggestions`;
  const searchExpanded = expandedPanel === "search";
  const filterExpanded = expandedPanel === "filter";

  useEffect(() => {
    if (searchExpanded) searchInputRef.current?.focus();
  }, [searchExpanded]);

  const applySearch = (value: string) => {
    const normalized = value.trim();
    const params = new URLSearchParams(currentSearchParams.toString());
    if (normalized) params.set("q", normalized); else params.delete("q");
    params.delete("page");
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  useEffect(() => {
    if (searchValue.trim() === keyword.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applySearch(searchValue), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue, keyword]);

  const closeSearch = () => {
    setExpandedPanel(null);
    requestAnimationFrame(() => searchButtonRef.current?.focus());
  };
  const closeFilter = () => {
    setExpandedPanel(null);
    requestAnimationFrame(() => filterButtonRef.current?.focus());
  };

  // Keep the resident presentation intact while routing the admin variant
  // through the shared admin shell during the migration.
  if (namespace === "admin-news") {
    return <AdminPageToolbar variant="list" title={title} description={description} actions={actions} search={{ keyword, placeholder: searchPlaceholder, label: "ค้นหาข่าว", suggestions: suggestionTitles }} filters={filters} activeFilterCount={activeFilterCount} />;
  }

  return (
    <section className="sticky top-[var(--app-sticky-top,4rem)] z-30 -mx-4 -mt-2 border-y border-gray-200 bg-gray-50/95 px-3 py-2 shadow-sm backdrop-blur transition-[top] duration-[var(--app-topbar-motion,180ms)] supports-[backdrop-filter]:bg-gray-50/90 sm:-mx-6 sm:-mt-3 sm:px-6 lg:mx-0 lg:rounded-xl lg:border lg:px-4" aria-label={`เครื่องมือ${title}`}>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold tracking-tight text-gray-900 sm:text-xl">{title}</h1>
          {description ? <p className="hidden truncate text-xs text-gray-500 sm:block lg:text-sm">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">{actions}</div> : null}
      </div>

      <div className="mt-2 flex h-11 min-w-0 items-center gap-2" onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        if (searchExpanded) closeSearch();
        if (filterExpanded) closeFilter();
      }}>
        <button
          ref={searchButtonRef}
          type="button"
          aria-label="ค้นหาข่าว"
          aria-expanded={searchExpanded}
          aria-controls={searchPanelId}
          onClick={() => setExpandedPanel(searchExpanded ? null : "search")}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </button>

        {searchExpanded ? (
          <form id={searchPanelId} action={searchAction} role="search" onSubmit={(event) => { event.preventDefault(); if (debounceRef.current) clearTimeout(debounceRef.current); applySearch(searchValue); }} className="flex min-w-0 flex-1 items-center gap-1.5">
            {Object.entries(hiddenInputs ?? {}).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
            <label htmlFor={`${namespace}-search-input`} className="sr-only">ค้นหาข่าว</label>
            <input
              ref={searchInputRef}
              id={`${namespace}-search-input`}
              name="q"
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              list={suggestionTitles.length ? suggestionsId : undefined}
              placeholder={searchPlaceholder}
              className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none placeholder:text-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 motion-safe:transition-[width,opacity]"
            />
            <button type="button" onClick={closeSearch} aria-label="หุบช่องค้นหาข่าว" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"><X className="h-4 w-4" /></button>
            <button type="submit" className="sr-only">ค้นหา</button>
          </form>
        ) : <div id={searchPanelId} hidden />}

        <button
          ref={filterButtonRef}
          type="button"
          aria-label="ตัวกรองข่าว"
          aria-expanded={filterExpanded}
          aria-controls={filterPanelId}
          onClick={() => setExpandedPanel(filterExpanded ? null : "filter")}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
        >
          <Filter className="h-4 w-4" aria-hidden="true" />
          <span className="hidden md:inline">ตัวกรอง</span>
          {activeFilterCount > 0 ? <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-green-600 px-1.5 text-xs font-semibold text-white">{activeFilterCount}</span> : null}
        </button>

        {filterExpanded ? (
          <div id={filterPanelId} className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain rounded-lg border border-gray-200 bg-white px-2 py-1.5 [scrollbar-width:thin]">
            <div className="flex w-max items-center gap-2 whitespace-nowrap">{filters}</div>
          </div>
        ) : <div id={filterPanelId} hidden />}
      </div>

      {suggestionTitles.length ? <datalist id={suggestionsId}>{suggestionTitles.map((value) => <option key={value} value={value} />)}</datalist> : null}
    </section>
  );
}

export function NewsFilterChip({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return <Link href={href} className={cn("inline-flex h-8 items-center rounded-full px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-green-500", active ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200")}>{children}</Link>;
}
