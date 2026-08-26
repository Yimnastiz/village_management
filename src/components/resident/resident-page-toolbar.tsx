"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, Filter, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { ResidentPageHeaderRegistration, useOptionalResidentPageHeader, useOptionalResidentPageHeaderRegistry } from "@/components/layout/resident-page-header-context";

type ExpandedPanel = "filter" | null;

type ResidentFilterDropdownContextValue = {
  openDropdown: string | null;
  setOpenDropdown: (dropdown: string | null) => void;
  keepFiltersOpen: () => void;
};

const ResidentFilterDropdownContext = createContext<ResidentFilterDropdownContextValue | null>(null);

function useResidentFilterDropdowns() {
  return useContext(ResidentFilterDropdownContext);
}

export type ResidentFilterOption = { label: string; href: string; active: boolean };

function useResidentDropdownMenu(label: string) {
  const dropdowns = useResidentFilterDropdowns();
  const [localOpen, setLocalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const isOpen = dropdowns ? dropdowns.openDropdown === label : localOpen;
  const setOpen = (open: boolean) => dropdowns ? dropdowns.setOpenDropdown(open ? label : null) : setLocalOpen(open);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsidePress = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsidePress);
    return () => document.removeEventListener("mousedown", closeOnOutsidePress);
  }, [isOpen]);

  return { dropdownRef, menuId, isOpen, setOpen, dropdowns };
}

/** Shared compact single-select control for Resident list filters. */
export function ResidentFilterDropdown({ label, options }: { label: string; options: ResidentFilterOption[] }) {
  const selected = options.find((option) => option.active) ?? options[0];
  const menu = useResidentDropdownMenu(label);
  return <div ref={menu.dropdownRef} className="relative shrink-0">
    <button type="button" aria-expanded={menu.isOpen} aria-controls={menu.menuId} onClick={() => menu.setOpen(!menu.isOpen)} className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500">
      <span className="truncate">{label}: {selected?.label}</span><ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", menu.isOpen && "rotate-180")} aria-hidden="true" />
    </button>
    {menu.isOpen ? <div id={menu.menuId} className="absolute left-0 top-full z-50 mt-1 max-h-[min(20rem,calc(100vh-8rem))] w-max min-w-40 max-w-[calc(100vw-2rem)] overflow-auto rounded-lg border border-gray-200 bg-white py-0.5 shadow-lg sm:left-auto sm:right-0">
      {options.map((option) => <Link key={`${label}-${option.label}`} href={option.href} aria-current={option.active ? "true" : undefined} onClick={() => { menu.setOpen(false); menu.dropdowns?.keepFiltersOpen(); }} className={cn("flex min-h-10 items-center justify-between gap-4 px-3 py-2 text-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:bg-green-50 sm:min-h-8 sm:py-1.5", option.active ? "bg-green-50 font-medium text-green-800" : "text-gray-700")}>
        <span>{option.label}</span>{option.active ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
      </Link>)}
    </div> : null}
  </div>;
}

/** Shared checkable dropdown for existing multi-select Resident filter semantics. */
export function ResidentMultiFilterDropdown({ label, options, clearHref }: { label: string; options: ResidentFilterOption[]; clearHref: string }) {
  const selected = options.filter((option) => option.active);
  const value = selected.length ? selected.map((option) => option.label).join(", ") : "ทั้งหมด";
  const menu = useResidentDropdownMenu(label);
  return <div ref={menu.dropdownRef} className="relative shrink-0">
    <button type="button" aria-expanded={menu.isOpen} aria-controls={menu.menuId} onClick={() => menu.setOpen(!menu.isOpen)} className="inline-flex h-9 max-w-[min(100%,18rem)] items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500">
      <span className="truncate">{label}: {value}</span><ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", menu.isOpen && "rotate-180")} aria-hidden="true" />
    </button>
    {menu.isOpen ? <div id={menu.menuId} className="absolute left-0 top-full z-50 mt-1 max-h-[min(20rem,calc(100vh-8rem))] w-max min-w-44 max-w-[calc(100vw-2rem)] overflow-auto rounded-lg border border-gray-200 bg-white py-0.5 shadow-lg sm:left-auto sm:right-0">
      <Link href={clearHref} aria-current={!selected.length ? "true" : undefined} onClick={() => { menu.setOpen(false); menu.dropdowns?.keepFiltersOpen(); }} className={cn("flex min-h-10 items-center justify-between gap-4 px-3 py-2 text-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:bg-green-50 sm:min-h-8 sm:py-1.5", !selected.length ? "bg-green-50 font-medium text-green-800" : "text-gray-700")}><span>ทั้งหมด</span>{!selected.length ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}</Link>
      {options.map((option) => <Link key={`${label}-${option.label}`} href={option.href} aria-current={option.active ? "true" : undefined} onClick={() => { menu.dropdowns?.keepFiltersOpen(); }} className={cn("flex min-h-10 items-center justify-between gap-4 px-3 py-2 text-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:bg-green-50 sm:min-h-8 sm:py-1.5", option.active ? "bg-green-50 font-medium text-green-800" : "text-gray-700")}><span>{option.label}</span>{option.active ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}</Link>)}
    </div> : null}
  </div>;
}

type ResidentPageToolbarProps = {
  /** A page-owned, deterministic prefix. It must be unique within the route. */
  namespace: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  search?: { keyword: string; placeholder: string; label?: string; suggestions?: string[] };
  filters?: ReactNode;
  activeFilterCount?: number;
  /** Opt in when the route's semantic title should appear in the Resident Topbar. */
  registerHeader?: boolean;
  /** Keeps backwards compatibility for routes not yet migrated to the Topbar title. */
  hideHeading?: boolean;
  sticky?: boolean;
  className?: string;
  compactSpacing?: boolean;
};

/** Shared Resident operational toolbar; pages continue to own filter and URL semantics. */
export function ResidentPageToolbar({
  namespace, title, description, actions, backHref, backLabel = "กลับรายการ", search, filters,
  activeFilterCount = 0, registerHeader = false, hideHeading, sticky = true, className,
  compactSpacing: _compactSpacing = false,
}: ResidentPageToolbarProps) {
  const residentPageHeaderRegistry = useOptionalResidentPageHeaderRegistry();
  const residentPageHeader = useOptionalResidentPageHeader();
  const [expandedPanel, setExpandedPanel] = useState<ExpandedPanel>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState(search?.keyword ?? "");
  const [, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const currentSearchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchPanelId = `${namespace}-search-panel`;
  const filterPanelId = `${namespace}-filter-panel`;
  const searchInputId = `${namespace}-search-input`;
  const suggestionsId = `${namespace}-search-suggestions`;
  const filterExpanded = expandedPanel === "filter";
  const filterPersistenceKey = `resident-toolbar:${pathname}:filters-open`;
  const searchLabel = search?.label ?? "ค้นหา";
  const hasTools = Boolean(search || filters);
  const shouldHideHeading = hideHeading ?? (registerHeader || Boolean(residentPageHeader));
  const backLink = backHref ? <Link href={backHref} className="inline-flex min-h-9 items-center gap-1.5 px-1 text-sm text-gray-500 transition-colors hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{backLabel}</Link> : null;

  useEffect(() => setSearchValue(search?.keyword ?? ""), [search?.keyword]);
  useEffect(() => {
    if (!filters || !sessionStorage.getItem(filterPersistenceKey)) return;
    sessionStorage.removeItem(filterPersistenceKey);
    setExpandedPanel("filter");
  }, [filterPersistenceKey, filters]);
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const applySearch = (value: string) => {
    const params = new URLSearchParams(currentSearchParams.toString());
    const normalized = value.trim();
    if (normalized) params.set("q", normalized); else params.delete("q");
    params.delete("page");
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  useEffect(() => {
    if (!search || searchValue.trim() === search.keyword.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applySearch(searchValue), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
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

  return <section
    className={cn(
      "relative z-30 -mx-4 -mt-4 shrink-0 overflow-visible border-y border-gray-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/90 sm:-mx-6 sm:-mt-6 sm:px-6 sm:py-4",
      sticky && "sticky top-[var(--app-sticky-top)] z-30 transition-[top] duration-[var(--app-topbar-motion,180ms)]",
      className,
    )}
    aria-label={`เครื่องมือ${title}`}
    data-resident-page-toolbar
  >
    {registerHeader && residentPageHeaderRegistry ? <ResidentPageHeaderRegistration context={{ title, description }} /> : null}
    {backLink ? <div className="mb-2">{backLink}</div> : null}

    {!shouldHideHeading ? <header className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <div className="min-w-0"><h1 className="truncate text-lg font-bold tracking-tight text-gray-900 sm:text-xl">{title}</h1>{description ? <p className="mt-0.5 hidden text-sm leading-5 text-gray-500 sm:block">{description}</p> : null}</div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">{actions}</div> : null}
    </header> : null}
    {shouldHideHeading && actions && !hasTools ? <div className="flex min-w-0 flex-wrap justify-end gap-2 sm:gap-3">{actions}</div> : null}

    {hasTools ? <div className={cn("flex min-w-0 flex-wrap items-center gap-2", !shouldHideHeading && "mt-2")} onKeyDown={(event) => { if (event.key === "Escape" && filterExpanded) closeFilter(); }}>
      {search ? <form id={searchPanelId} role="search" onSubmit={(event) => { event.preventDefault(); if (debounceRef.current) clearTimeout(debounceRef.current); applySearch(searchValue); }} className="relative flex min-w-0 w-full shrink-0 items-center sm:w-[clamp(14rem,28vw,24rem)]">
        <label htmlFor={searchInputId} className="sr-only">{searchLabel}</label>
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-gray-400" aria-hidden="true" />
        <input ref={searchInputRef} id={searchInputId} name="q" type="search" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} list={search.suggestions?.length ? suggestionsId : undefined} placeholder={search.placeholder} className="h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white pl-9 pr-10 text-sm outline-none placeholder:text-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 [::-webkit-search-cancel-button]:appearance-none" />
        {searchValue ? <button type="button" onClick={() => { if (debounceRef.current) clearTimeout(debounceRef.current); setSearchValue(""); applySearch(""); searchInputRef.current?.focus(); }} aria-label={`ล้าง${searchLabel}`} className="absolute right-1.5 inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"><X className="h-4 w-4" aria-hidden="true" /></button> : null}
      </form> : null}
      {filters ? <>
        <button ref={filterButtonRef} type="button" aria-label="ตัวกรอง" aria-expanded={filterExpanded} aria-controls={filterPanelId} onClick={() => setExpandedPanel(filterExpanded ? null : "filter")} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"><Filter className="h-4 w-4" aria-hidden="true" /><span className="hidden md:inline">ตัวกรอง</span>{activeFilterCount > 0 ? <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-green-600 px-1.5 text-xs font-semibold text-white">{activeFilterCount}</span> : null}</button>
        {filterExpanded ? <ResidentFilterDropdownContext.Provider value={{ openDropdown, setOpenDropdown, keepFiltersOpen }}><div id={filterPanelId} className="relative z-30 order-last flex min-w-0 basis-full flex-wrap items-center gap-2 overflow-visible rounded-lg border border-gray-200 bg-white px-2 py-1.5" onClickCapture={keepFiltersOpen} onChangeCapture={keepFiltersOpen}>{filters}</div></ResidentFilterDropdownContext.Provider> : <div id={filterPanelId} hidden />}
      </> : null}
      {shouldHideHeading && actions ? <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">{actions}</div> : null}
    </div> : null}
    {search?.suggestions?.length ? <datalist id={suggestionsId}>{search.suggestions.map((value) => <option key={value} value={value} />)}</datalist> : null}
  </section>;
}
