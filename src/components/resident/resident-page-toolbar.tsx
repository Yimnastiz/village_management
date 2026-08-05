"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Filter, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type ExpandedPanel = "search" | "filter" | null;

type ResidentPageToolbarProps = {
  /** A page-owned, deterministic prefix. It must be unique within the route. */
  namespace: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  search?: {
    keyword: string;
    placeholder: string;
    label?: string;
    suggestions?: string[];
  };
  filters?: ReactNode;
  activeFilterCount?: number;
  className?: string;
};

/**
 * The Resident list-page chrome.  Pages own their filter links, while this
 * component owns the common responsive interaction, accessibility and URL
 * synchronisation rules.
 */
export function ResidentPageToolbar({
  namespace,
  title,
  description,
  actions,
  search,
  filters,
  activeFilterCount = 0,
  className,
}: ResidentPageToolbarProps) {
  const [expandedPanel, setExpandedPanel] = useState<ExpandedPanel>(search?.keyword ? "search" : null);
  const [searchValue, setSearchValue] = useState(search?.keyword ?? "");
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
  const searchLabel = search?.label ?? "ค้นหา";

  useEffect(() => {
    setSearchValue(search?.keyword ?? "");
  }, [search?.keyword]);

  useEffect(() => {
    if (searchExpanded) searchInputRef.current?.focus();
  }, [searchExpanded]);

  const applySearch = (value: string) => {
    const params = new URLSearchParams(currentSearchParams.toString());
    const normalized = value.trim();
    if (normalized) params.set("q", normalized);
    else params.delete("q");
    params.delete("page");
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  useEffect(() => {
    if (!search || searchValue.trim() === search.keyword.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applySearch(searchValue), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // applySearch intentionally reads the current URL at the moment of update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, searchValue]);

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
    if (filterExpanded) closeFilter();
  };

  return (
    <section
      className={cn("sticky top-[var(--resident-sticky-top,var(--app-sticky-top,4rem))] z-30 -mx-4 -mt-2 border-y border-gray-200 bg-gray-50/95 px-3 py-2 shadow-sm backdrop-blur transition-[top] duration-[var(--app-topbar-motion,180ms)] supports-[backdrop-filter]:bg-gray-50/90 sm:-mx-6 sm:-mt-3 sm:px-6 lg:mx-0 lg:rounded-xl lg:border lg:px-4", className)}
      aria-label={`เครื่องมือ${title}`}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold tracking-tight text-gray-900 sm:text-xl">{title}</h1>
          {description ? <p className="hidden truncate text-xs text-gray-500 sm:block lg:text-sm">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">{actions}</div> : null}
      </div>

      {(search || filters) ? <div className="mt-2 flex h-11 min-w-0 items-center gap-2" onKeyDown={(event) => {
        if (event.key === "Escape") closeExpandedPanel();
      }}>
        {search ? <>
          <button ref={searchButtonRef} type="button" aria-label="ค้นหา" aria-expanded={searchExpanded} aria-controls={searchPanelId} onClick={() => setExpandedPanel(searchExpanded ? null : "search")} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1">
            <Search className="h-4 w-4" aria-hidden="true" />
          </button>
          {searchExpanded ? <form id={searchPanelId} role="search" onSubmit={(event) => { event.preventDefault(); if (debounceRef.current) clearTimeout(debounceRef.current); applySearch(searchValue); }} className="flex min-w-0 flex-1 items-center gap-1.5">
            <label htmlFor={`${namespace}-search-input`} className="sr-only">{searchLabel}</label>
            <input ref={searchInputRef} id={`${namespace}-search-input`} name="q" type="search" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} list={search.suggestions?.length ? suggestionsId : undefined} placeholder={search.placeholder} className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none placeholder:text-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500" />
            <button type="button" onClick={closeSearch} aria-label={`หุบช่อง${searchLabel}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"><X className="h-4 w-4" aria-hidden="true" /></button>
            <button type="submit" className="sr-only">ค้นหา</button>
          </form> : <div id={searchPanelId} hidden />}
        </> : null}

        {filters ? <>
          <button ref={filterButtonRef} type="button" aria-label="ตัวกรอง" aria-expanded={filterExpanded} aria-controls={filterPanelId} onClick={() => setExpandedPanel(filterExpanded ? null : "filter")} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1">
            <Filter className="h-4 w-4" aria-hidden="true" />
            <span className="hidden md:inline">ตัวกรอง</span>
            {activeFilterCount > 0 ? <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-green-600 px-1.5 text-xs font-semibold text-white">{activeFilterCount}</span> : null}
          </button>
          {filterExpanded ? <div id={filterPanelId} className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain rounded-lg border border-gray-200 bg-white px-2 py-1.5 [scrollbar-width:thin]"><div className="flex w-max items-center gap-2 whitespace-nowrap">{filters}</div></div> : <div id={filterPanelId} hidden />}
        </> : null}
      </div> : null}

      {search?.suggestions?.length ? <datalist id={suggestionsId}>{search.suggestions.map((value) => <option key={value} value={value} />)}</datalist> : null}
    </section>
  );
}
