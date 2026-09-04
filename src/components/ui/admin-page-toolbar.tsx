"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Filter, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { AdminPageHeaderRegistration, useOptionalAdminPageHeaderRegistry } from "@/components/layout/admin-page-header-context";

type ExpandedPanel = "filter" | null;

type AdminFilterDropdownContextValue = {
  openDropdown: string | null;
  setOpenDropdown: (dropdown: string | null) => void;
  keepFiltersOpen: () => void;
};

const AdminFilterDropdownContext = createContext<AdminFilterDropdownContextValue | null>(null);

export function useAdminFilterDropdowns() {
  return useContext(AdminFilterDropdownContext);
}

export type AdminPageToolbarVariant = "list" | "detail" | "form" | "request";
export type AdminPageToolbarBackPlacement = "top" | "header-start" | "header-end";

type AdminPageToolbarProps = {
  title: string;
  description?: string;
  variant?: AdminPageToolbarVariant;
  backHref?: string;
  backLabel?: string;
  /** Where to place the explicit navigation link for an admin sub-page. */
  backPlacement?: AdminPageToolbarBackPlacement;
  actions?: ReactNode;
  /** Contextual controls that belong beneath the heading, such as request tabs. */
  secondaryActions?: ReactNode;
  sticky?: boolean;
  compact?: boolean;
  search?: {
    keyword: string;
    placeholder: string;
    label?: string;
    suggestions?: string[];
  };
  filters?: ReactNode;
  activeFilterCount?: number;
  /** Keeps the search field open for list pages that need persistent searching. */
  searchAlwaysVisible?: boolean;
  /** Retained for compatibility; expanded filters now share the toolbar row by default. */
  filtersInlineWithSearch?: boolean;
  /** Lets workspace pages keep the shared tools without repeating the page header. */
  hideHeading?: boolean;
  className?: string;
};

/**
 * Shared operational-page chrome for the admin area.
 *
 * Pages own their actions and business-specific filter controls; this component
 * owns the optional sticky shell, responsive tool expansion, focus restoration and URL
 * search synchronization. It deliberately has no route-specific behavior.
 */
export function AdminPageToolbar({
  title,
  description,
  variant = "detail",
  backHref,
  backLabel = "กลับรายการ",
  backPlacement = "top",
  actions,
  secondaryActions,
  sticky = false,
  compact = false,
  search,
  filters,
  activeFilterCount = 0,
  searchAlwaysVisible = true,
  filtersInlineWithSearch: _filtersInlineWithSearch = false,
  hideHeading = false,
  className,
}: AdminPageToolbarProps) {
  const adminPageHeaderRegistry = useOptionalAdminPageHeaderRegistry();
  const [expandedPanel, setExpandedPanel] = useState<ExpandedPanel>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState(search?.keyword ?? "");
  const [, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const currentSearchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isComposingRef = useRef(false);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const namespace = `admin-toolbar-${title.toLowerCase().replace(/\s+/g, "-")}`;
  const searchPanelId = `${namespace}-search-panel`;
  const filterPanelId = `${namespace}-filter-panel`;
  const searchInputId = `${namespace}-search-input`;
  const suggestionsId = `${namespace}-search-suggestions`;
  const searchExpanded = true;
  const filterExpanded = expandedPanel === "filter";
  const filterPersistenceKey = `admin-toolbar:${pathname}:filters-open`;
  const searchLabel = search?.label ?? "ค้นหา";
  const hasTools = Boolean(search || filters);
  const backLink = backHref ? (
    <Link href={backHref} className="inline-flex min-h-9 items-center gap-1.5 px-1 text-sm text-gray-500 transition-colors hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {backLabel}
    </Link>
  ) : null;

  useEffect(() => setSearchValue(search?.keyword ?? ""), [search?.keyword]);
  useEffect(() => {
    if (!filters || !sessionStorage.getItem(filterPersistenceKey)) return;
    sessionStorage.removeItem(filterPersistenceKey);
    setExpandedPanel("filter");
  }, [filterPersistenceKey, filters]);
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

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
    if (!search || isComposingRef.current || searchValue.trim() === search.keyword.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applySearch(searchValue), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // URL state is intentionally read when the debounced update runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, searchValue]);

  const closeFilter = () => {
    setExpandedPanel(null);
    setOpenDropdown(null);
    requestAnimationFrame(() => filterButtonRef.current?.focus());
  };
  const keepFiltersOpen = () => {
    sessionStorage.setItem(filterPersistenceKey, "true");
    setExpandedPanel("filter");
  };
  const closeSearch = () => undefined;
  const closeExpandedPanel = () => {
    if (filterExpanded) closeFilter();
  };

  return (
    <section
      className={cn(
        cn(
          "relative z-30 -mx-4 shrink-0 overflow-visible border-y border-gray-200 bg-white/95 px-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/90 sm:-mx-6 sm:px-6",
          compact ? "py-1.5 sm:py-1.5" : "py-3 sm:py-4",
        ),
        sticky && "sticky top-[var(--app-sticky-top,4rem)] z-30 transition-[top] duration-[var(--app-topbar-motion,180ms)]",
        className,
      )}
      aria-label={`เครื่องมือ${title}`}
      data-admin-page-toolbar={variant}
    >
      {adminPageHeaderRegistry ? <AdminPageHeaderRegistration context={{ title, description }} /> : null}
      {backPlacement === "top" && backLink ? <div className="mb-2">{backLink}</div> : null}

      {!hideHeading && !adminPageHeaderRegistry ? (
        <header className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          {backPlacement === "header-start" && backLink ? (
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="shrink-0">{backLink}</div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold tracking-tight text-gray-900 sm:text-xl">{title}</h1>
                {description ? <p className={cn("mt-0.5 text-sm leading-5 text-gray-500", "hidden sm:block")}>{description}</p> : null}
              </div>
            </div>
          ) : (
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight text-gray-900 sm:text-xl">{title}</h1>
              {description ? <p className={cn("mt-0.5 text-sm leading-5 text-gray-500", backPlacement === "header-end" ? "block" : "hidden sm:block")}>{description}</p> : null}
            </div>
          )}
          {actions || (backPlacement === "header-end" && backLink) ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
              {backPlacement === "header-end" ? backLink : null}
              {actions}
            </div>
          ) : null}
        </header>
      ) : null}
      {(hideHeading || adminPageHeaderRegistry) && actions && !hasTools ? <div className="flex min-w-0 flex-wrap justify-end gap-2 sm:gap-3">{actions}</div> : null}

      {secondaryActions ? <div className="mt-2 flex min-w-0 justify-start sm:justify-end">{secondaryActions}</div> : null}

      {hasTools ? <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2" onKeyDown={(event) => {
        if (event.key === "Escape") closeExpandedPanel();
      }}>
        {search ? <>
          {!searchAlwaysVisible ?
          <button ref={searchButtonRef} type="button" aria-label={searchLabel} aria-expanded={searchExpanded} aria-controls={searchPanelId} onClick={closeSearch} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1">
            <Search className="h-4 w-4" aria-hidden="true" />
          </button> : null}
          {searchExpanded ? <form id={searchPanelId} role="search" onSubmit={(event) => { event.preventDefault(); if (debounceRef.current) clearTimeout(debounceRef.current); applySearch(searchValue); }} className={cn("relative flex min-w-0 items-center", searchAlwaysVisible ? "w-full shrink-0 sm:w-[clamp(14rem,28vw,24rem)]" : "flex-1 gap-1.5")}>
            <label htmlFor={searchInputId} className="sr-only">{searchLabel}</label>
            {searchAlwaysVisible ? <Search className="pointer-events-none absolute left-3 h-4 w-4 text-gray-400" aria-hidden="true" /> : null}
            <input ref={searchInputRef} id={searchInputId} name="q" type="search" value={searchValue} onCompositionStart={() => { isComposingRef.current = true; if (debounceRef.current) clearTimeout(debounceRef.current); }} onCompositionEnd={(event) => { isComposingRef.current = false; const value = event.currentTarget.value; if (debounceRef.current) clearTimeout(debounceRef.current); if (value.trim() !== search.keyword.trim()) debounceRef.current = setTimeout(() => applySearch(value), 350); }} onChange={(event) => setSearchValue(event.target.value)} list={search.suggestions?.length ? suggestionsId : undefined} placeholder={search.placeholder} className={cn("min-w-0 flex-1 rounded-lg border border-gray-300 bg-white text-sm outline-none placeholder:text-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 [::-webkit-search-cancel-button]:appearance-none", compact ? "h-9" : "h-11", searchAlwaysVisible ? "w-full pl-9 pr-10" : "px-3")} />
            {searchAlwaysVisible && searchValue ? <button type="button" onClick={() => { if (debounceRef.current) clearTimeout(debounceRef.current); setSearchValue(""); applySearch(""); searchInputRef.current?.focus(); }} aria-label={`ล้าง${searchLabel}`} className="absolute right-1.5 inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500">
              <X className="h-4 w-4" aria-hidden="true" />
            </button> : null}
            {!searchAlwaysVisible ? <>
            <button type="button" onClick={closeSearch} aria-label={`ปิดช่อง${searchLabel}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"><X className="h-4 w-4" aria-hidden="true" /></button>
            <button type="submit" className="sr-only">ค้นหา</button>
            </> : null}
          </form> : <div id={searchPanelId} hidden />}
        </> : null}
        {filters ? <>
          <button ref={filterButtonRef} type="button" aria-label="ตัวกรอง" aria-expanded={filterExpanded} aria-controls={filterPanelId} onClick={() => filterExpanded ? closeFilter() : setExpandedPanel("filter")} className={cn("inline-flex shrink-0 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1", compact ? "h-9" : "h-11")}>
            <Filter className="h-4 w-4" aria-hidden="true" />
            <span className="hidden md:inline">ตัวกรอง</span>
            {activeFilterCount > 0 ? <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-green-600 px-1.5 text-xs font-semibold text-white">{activeFilterCount}</span> : null}
          </button>
          {filterExpanded ? <AdminFilterDropdownContext.Provider value={{ openDropdown, setOpenDropdown, keepFiltersOpen }}><div id={filterPanelId} className="relative z-30 order-last flex w-full basis-full flex-wrap items-center gap-2 overflow-visible rounded-lg border border-gray-200 bg-white px-2 py-1.5">{filters}</div></AdminFilterDropdownContext.Provider> : <div id={filterPanelId} hidden />}
        </> : null}
        {(hideHeading || adminPageHeaderRegistry) && actions ? <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">{actions}</div> : null}
      </div> : null}
      {search?.suggestions?.length ? <datalist id={suggestionsId}>{search.suggestions.map((value) => <option key={value} value={value} />)}</datalist> : null}
    </section>
  );
}
