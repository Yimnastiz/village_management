"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Filter, RotateCcw, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  formatThaiMonthYear,
  THAI_MONTH_NAMES,
} from "@/lib/calendar-month";
import { cn } from "@/lib/utils";
import { AdminPageHeaderRegistration, useOptionalAdminPageHeaderRegistry } from "@/components/layout/admin-page-header-context";
import { AdminFilterDropdown, type ToolbarGroup } from "@/components/ui/admin-list-toolbar";

type CalendarToolbarProps = {
  namespace: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  currentYear: number;
  currentMonth: number;
  yearStart: number;
  yearEnd: number;
  todayMonthKey: string;
  /** Resident calendar uses a single compact month control on small screens. */
  residentCompact?: boolean;
  search?: {
    keyword: string;
    placeholder: string;
    suggestions?: string[];
  };
  filters?: ReactNode;
  adminFilterGroups?: ToolbarGroup[];
};

export function CalendarToolbar({
  namespace,
  title,
  description,
  actions,
  currentYear,
  currentMonth,
  yearStart,
  yearEnd,
  todayMonthKey,
  residentCompact = false,
  search,
  filters,
  adminFilterGroups = [],
}: CalendarToolbarProps) {
  const adminPageHeaderRegistry = useOptionalAdminPageHeaderRegistry();
  const pathname = usePathname();
  const router = useRouter();
  const currentSearchParams = useSearchParams();
  const isAdminToolbar = Boolean(adminPageHeaderRegistry);
  const [isSearchOpen, setIsSearchOpen] = useState(Boolean(search?.keyword) || isAdminToolbar);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(search?.keyword ?? "");
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(currentYear);
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchPanelId = `${namespace}-search-panel`;
  const suggestionsId = `${namespace}-search-suggestions`;
  const monthIndex = currentMonth - 1;
  const monthLabel = formatThaiMonthYear(currentYear, monthIndex, "long");
  const compactMonthLabel = formatThaiMonthYear(currentYear, monthIndex, "short");
  const filtersVisible = !isAdminToolbar || isFilterOpen;
  const filterPersistenceKey = `calendar-toolbar:${pathname}:filters-open`;
  const years = Array.from({ length: yearEnd - yearStart + 1 }, (_, index) => yearStart + index);

  useEffect(() => {
    setSearchValue(search?.keyword ?? "");
  }, [search?.keyword]);

  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus();
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isMonthPickerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMonthPickerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMonthPickerOpen]);

  useEffect(() => {
    if (!isMonthPickerOpen) setPickerYear(currentYear);
  }, [currentYear, isMonthPickerOpen]);

  useEffect(() => {
    if (!isAdminToolbar || !sessionStorage.getItem(filterPersistenceKey)) return;
    sessionStorage.removeItem(filterPersistenceKey);
    setIsFilterOpen(true);
  }, [filterPersistenceKey, isAdminToolbar]);

  const buildHref = (year: number, month: number) => {
    const params = new URLSearchParams(currentSearchParams.toString());
    params.set("month", `${year}-${String(month).padStart(2, "0")}`);
    params.delete("date");
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const todayHref = () => {
    const params = new URLSearchParams(currentSearchParams.toString());
    params.set("month", todayMonthKey);
    params.delete("date");
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const navigateToMonth = (year: number, month: number) => {
    startTransition(() => router.replace(buildHref(year, month), { scroll: false }));
  };

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
    // applySearch intentionally reads the latest URL search params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, searchValue]);

  const previousMonthDate = new Date(currentYear, currentMonth - 2, 1);
  const nextMonthDate = new Date(currentYear, currentMonth, 1);

  return (
    <section
      className={cn(
        "sticky top-[var(--resident-sticky-top,var(--app-sticky-top,4rem))] z-30 border-gray-200 bg-gray-50/95 shadow-sm backdrop-blur transition-[top] duration-[var(--app-topbar-motion,180ms)] supports-[backdrop-filter]:bg-gray-50/90",
        isAdminToolbar ? "-mx-4 border-y px-4 py-3 sm:-mx-6 sm:px-6 sm:py-4" : "-mx-4 -mt-2 border-y px-3 py-2 sm:-mx-6 sm:-mt-3 sm:px-6 lg:mx-0 lg:rounded-xl lg:border lg:px-4",
      )}
      aria-label={`เครื่องมือ${title}`}
    >
      {adminPageHeaderRegistry ? <AdminPageHeaderRegistration context={{ title, description }} /> : null}
      <div className="flex min-w-0 items-center justify-between gap-2">
        {!adminPageHeaderRegistry ? <div className="min-w-0">
          <h1 className="truncate text-lg font-bold tracking-tight text-gray-900 sm:text-xl">{title}</h1>
          {description ? <p className="hidden truncate text-xs text-gray-500 sm:block lg:text-sm">{description}</p> : null}
        </div> : null}
        {!isAdminToolbar && actions ? <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">{actions}</div> : null}
      </div>

      <div className="mt-2 flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center">
        <div className={cn("relative grid min-w-0 items-center gap-2 sm:w-auto sm:min-w-80", residentCompact ? "grid-cols-[36px_minmax(0,1fr)_36px_auto] sm:grid-cols-[44px_minmax(0,1fr)_44px]" : "grid-cols-[44px_minmax(0,1fr)_44px]")}>
          <Link
            href={buildHref(previousMonthDate.getFullYear(), previousMonthDate.getMonth() + 1)}
            aria-label="เดือนก่อนหน้า"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <button type="button" onClick={() => { if (residentCompact) { setPickerYear(currentYear); setIsMonthPickerOpen((open) => !open); } }} aria-expanded={residentCompact ? isMonthPickerOpen : undefined} aria-controls={residentCompact ? `${namespace}-month-picker` : undefined} className={cn("min-w-0 truncate text-center text-sm font-semibold text-gray-900 sm:text-base", residentCompact && "cursor-pointer rounded-md px-1 focus:outline-none focus:ring-2 focus:ring-green-500")}>
            <span className="hidden min-[390px]:inline">{monthLabel}</span>
            <span className="min-[390px]:hidden">{compactMonthLabel}</span>
          </button>
          <Link
            href={buildHref(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1)}
            aria-label="เดือนถัดไป"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          {residentCompact ? <Link href={todayHref()} className="inline-flex h-9 items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 sm:hidden"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />เดือนนี้</Link> : null}
          {residentCompact && isMonthPickerOpen ? (
            <section
              id={`${namespace}-month-picker`}
              role="dialog"
              aria-label="เลือกเดือนและปี"
              className="absolute inset-x-0 top-full z-50 mt-2 max-h-[min(70vh,32rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 shadow-xl sm:left-1/2 sm:right-auto sm:w-80 sm:-translate-x-1/2 sm:p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-semibold text-gray-900">เลือกเดือนและปี</h2>
                <button type="button" onClick={() => setIsMonthPickerOpen(false)} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500">
                  <X className="h-4 w-4" aria-hidden="true" />
                  ปิด
                </button>
              </div>
              <label className="sr-only" htmlFor={`${namespace}-compact-year`}>เลือกปี</label>
              <select id={`${namespace}-compact-year`} value={pickerYear} onChange={(event) => setPickerYear(Number(event.target.value))} className="mb-3 h-11 w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500">
                {years.map((year) => <option key={year} value={year}>{year + 543}</option>)}
              </select>
              <div className="grid grid-cols-3 gap-2">
                {THAI_MONTH_NAMES.map((name, index) => (
                  <button key={name} type="button" onClick={() => { navigateToMonth(pickerYear, index + 1); setIsMonthPickerOpen(false); }} className={cn("min-h-11 cursor-pointer rounded-lg px-2 text-sm text-gray-700 hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-500", pickerYear === currentYear && index + 1 === currentMonth && "bg-green-100 font-semibold text-green-800")}>
                    {name}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <div className={cn("grid min-w-0 grid-cols-[minmax(0,1fr)_7rem_44px] items-center gap-2 sm:flex sm:w-auto sm:justify-end", residentCompact && "hidden sm:flex")}>
          <label className="sr-only" htmlFor={`${namespace}-month`}>เลือกเดือน</label>
          <select
            id={`${namespace}-month`}
            value={currentMonth}
            onChange={(event) => navigateToMonth(currentYear, Number(event.target.value))}
            className="h-11 min-w-0 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 shadow-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 sm:w-40"
          >
            {THAI_MONTH_NAMES.map((monthName, index) => (
              <option key={monthName} value={index + 1}>{monthName}</option>
            ))}
          </select>

          <label className="sr-only" htmlFor={`${namespace}-year`}>เลือกปี</label>
          <select
            id={`${namespace}-year`}
            value={currentYear}
            onChange={(event) => navigateToMonth(Number(event.target.value), currentMonth)}
            className="h-11 min-w-0 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 shadow-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 sm:w-28"
          >
            {years.map((year) => (
              <option key={year} value={year}>{year + 543}</option>
            ))}
          </select>

          <Link
            href={todayHref()}
            aria-label="กลับไปเดือนปัจจุบัน"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 sm:w-auto sm:gap-1.5"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{residentCompact ? "เดือนนี้" : "วันนี้"}</span>
          </Link>
        </div>
        {isAdminToolbar && actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 lg:ml-auto">{actions}</div> : null}
      </div>

      {(search || filters) ? (
        <div className="mt-2 flex min-h-11 min-w-0 flex-wrap items-center gap-2">
          {search ? (
            <>
              <button
                type="button"
                aria-label="ค้นหากิจกรรม"
                aria-expanded={isSearchOpen}
                aria-controls={searchPanelId}
                onClick={() => setIsSearchOpen((value) => !value)}
                className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1", isAdminToolbar && "hidden")}
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </button>
              {isSearchOpen ? (
                <form
                  id={searchPanelId}
                  role="search"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    applySearch(searchValue);
                  }}
                  className={cn("relative flex min-w-0 basis-full items-center gap-1.5 sm:w-[min(26rem,40vw)] sm:basis-auto", isAdminToolbar && "sm:w-[clamp(14rem,28vw,24rem)]")}
                >
                  <label htmlFor={`${namespace}-search-input`} className="sr-only">ค้นหากิจกรรม</label>
                  {isAdminToolbar ? <Search className="pointer-events-none absolute left-3 h-4 w-4 text-gray-400" aria-hidden="true" /> : null}
                  <input
                    ref={searchInputRef}
                    id={`${namespace}-search-input`}
                    name="q"
                    type="search"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    list={search.suggestions?.length ? suggestionsId : undefined}
                    placeholder={search.placeholder}
                    className={cn("h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none placeholder:text-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 [::-webkit-search-cancel-button]:appearance-none", isAdminToolbar && "w-full pl-9 pr-10")}
                  />
                  {isAdminToolbar && searchValue ? <button type="button" onClick={() => { if (debounceRef.current) clearTimeout(debounceRef.current); setSearchValue(""); applySearch(""); searchInputRef.current?.focus(); }} aria-label="ล้างการค้นหากิจกรรม" className="absolute right-1.5 inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"><X className="h-4 w-4" aria-hidden="true" /></button> : null}
                  <button
                    type="button"
                    onClick={() => setIsSearchOpen(false)}
                    aria-label="ปิดช่องค้นหากิจกรรม"
                    className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500", isAdminToolbar && "hidden")}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button type="submit" className="sr-only">ค้นหา</button>
                </form>
              ) : <div id={searchPanelId} hidden />}
            </>
          ) : null}

          {filters ? <>
            {isAdminToolbar ? <button type="button" aria-expanded={isFilterOpen} onClick={() => setIsFilterOpen((open) => !open)} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"><Filter className="h-4 w-4" aria-hidden="true" /><span>ตัวกรอง</span></button> : null}
            {filtersVisible ? <div className={cn(isAdminToolbar ? "relative z-40 flex min-w-0 flex-wrap items-center gap-2 overflow-visible" : "min-w-0 flex-1 overflow-x-auto overscroll-x-contain rounded-lg border border-gray-200 bg-white px-2 py-1.5 [scrollbar-width:thin]", search && isSearchOpen && !isAdminToolbar ? "hidden md:block" : "")} onClickCapture={() => { if (isAdminToolbar) sessionStorage.setItem(filterPersistenceKey, "true"); }}>
              <div className={cn("flex items-center gap-2", isAdminToolbar ? "flex-wrap" : "w-max whitespace-nowrap")}>{isAdminToolbar && adminFilterGroups.length ? adminFilterGroups.map((group) => <AdminFilterDropdown key={group.label} group={group} />) : filters}</div>
            </div> : null}
          </> : null}
        </div>
      ) : null}

      {search?.suggestions?.length ? (
        <datalist id={suggestionsId}>{search.suggestions.map((value) => <option key={value} value={value} />)}</datalist>
      ) : null}
    </section>
  );
}
