"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  formatThaiMonthYear,
  THAI_MONTH_NAMES,
} from "@/lib/calendar-month";
import { cn } from "@/lib/utils";

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
}: CalendarToolbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const currentSearchParams = useSearchParams();
  const [isSearchOpen, setIsSearchOpen] = useState(Boolean(search?.keyword));
  const [searchValue, setSearchValue] = useState(search?.keyword ?? "");
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchPanelId = `${namespace}-search-panel`;
  const suggestionsId = `${namespace}-search-suggestions`;
  const monthIndex = currentMonth - 1;
  const monthLabel = formatThaiMonthYear(currentYear, monthIndex, "long");
  const compactMonthLabel = formatThaiMonthYear(currentYear, monthIndex, "short");
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
      className="sticky top-[var(--resident-sticky-top,var(--app-sticky-top,4rem))] z-30 -mx-4 -mt-2 border-y border-gray-200 bg-gray-50/95 px-3 py-2 shadow-sm backdrop-blur transition-[top] duration-[var(--app-topbar-motion,180ms)] supports-[backdrop-filter]:bg-gray-50/90 sm:-mx-6 sm:-mt-3 sm:px-6 lg:mx-0 lg:rounded-xl lg:border lg:px-4"
      aria-label={`เครื่องมือ${title}`}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold tracking-tight text-gray-900 sm:text-xl">{title}</h1>
          {description ? <p className="hidden truncate text-xs text-gray-500 sm:block lg:text-sm">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">{actions}</div> : null}
      </div>

      <div className="mt-2 flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className={cn("grid min-w-0 items-center gap-2 sm:w-auto sm:min-w-80", residentCompact ? "grid-cols-[36px_minmax(0,1fr)_36px_auto] sm:grid-cols-[44px_minmax(0,1fr)_44px]" : "grid-cols-[44px_minmax(0,1fr)_44px]")}>
          <Link
            href={buildHref(previousMonthDate.getFullYear(), previousMonthDate.getMonth() + 1)}
            aria-label="เดือนก่อนหน้า"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <button type="button" onClick={() => residentCompact && setIsMonthPickerOpen(true)} aria-haspopup={residentCompact ? "dialog" : undefined} className={cn("min-w-0 truncate text-center text-sm font-semibold text-gray-900 sm:text-base", residentCompact && "cursor-pointer rounded-md px-1 focus:outline-none focus:ring-2 focus:ring-green-500 sm:cursor-default sm:focus:ring-0")}>
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
          {residentCompact ? <Link href={todayHref()} className="inline-flex h-9 items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 sm:hidden"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />วันนี้</Link> : null}
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
            <span className="hidden sm:inline">วันนี้</span>
          </Link>
        </div>
      </div>

      {residentCompact && isMonthPickerOpen ? <div role="dialog" aria-modal="true" aria-label="เลือกเดือนและปี" className="fixed inset-0 z-50 flex items-end bg-black/30 p-3 sm:items-center sm:justify-center" onClick={() => setIsMonthPickerOpen(false)}><div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}><div className="mb-3 flex items-center justify-between"><p className="font-semibold text-gray-900">เลือกเดือนและปี</p><button type="button" onClick={() => setIsMonthPickerOpen(false)} className="text-sm text-gray-500 hover:text-gray-800">ปิด</button></div><select value={currentYear} onChange={(event) => navigateToMonth(Number(event.target.value), currentMonth)} className="mb-3 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm">{years.map(year => <option key={year} value={year}>{year + 543}</option>)}</select><div className="grid grid-cols-3 gap-2">{THAI_MONTH_NAMES.map((name, index) => <button key={name} type="button" onClick={() => { navigateToMonth(currentYear, index + 1); setIsMonthPickerOpen(false); }} className={cn("min-h-10 rounded-lg px-2 text-sm hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-500", index + 1 === currentMonth && "bg-green-100 font-semibold text-green-800")}>{name}</button>)}</div></div></div> : null}

      {(search || filters) ? (
        <div className="mt-2 flex min-h-11 min-w-0 items-center gap-2">
          {search ? (
            <>
              <button
                type="button"
                aria-label="ค้นหากิจกรรม"
                aria-expanded={isSearchOpen}
                aria-controls={searchPanelId}
                onClick={() => setIsSearchOpen((value) => !value)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
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
                  className="flex min-w-0 flex-1 items-center gap-1.5"
                >
                  <label htmlFor={`${namespace}-search-input`} className="sr-only">ค้นหากิจกรรม</label>
                  <input
                    ref={searchInputRef}
                    id={`${namespace}-search-input`}
                    name="q"
                    type="search"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    list={search.suggestions?.length ? suggestionsId : undefined}
                    placeholder={search.placeholder}
                    className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none placeholder:text-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                  />
                  <button
                    type="button"
                    onClick={() => setIsSearchOpen(false)}
                    aria-label="ปิดช่องค้นหากิจกรรม"
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button type="submit" className="sr-only">ค้นหา</button>
                </form>
              ) : <div id={searchPanelId} hidden />}
            </>
          ) : null}

          {filters ? (
            <div className={cn("min-w-0 flex-1 overflow-x-auto overscroll-x-contain rounded-lg border border-gray-200 bg-white px-2 py-1.5 [scrollbar-width:thin]", search && isSearchOpen ? "hidden md:block" : "")}>
              <div className="flex w-max items-center gap-2 whitespace-nowrap">{filters}</div>
            </div>
          ) : null}
        </div>
      ) : null}

      {search?.suggestions?.length ? (
        <datalist id={suggestionsId}>{search.suggestions.map((value) => <option key={value} value={value} />)}</datalist>
      ) : null}
    </section>
  );
}
