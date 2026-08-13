"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Filter, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type ExpandedPanel = "search" | "filter" | null;
type Occupancy = "all" | "withPeople" | "withoutPeople";
type Sort = "asc" | "desc";

type HousesToolbarProps = {
  keyword: string;
  occupancy: Occupancy;
  sort: Sort;
  suggestions: string[];
};

const namespace = "admin-houses";

export function HousesToolbar({ keyword, occupancy, sort, suggestions }: HousesToolbarProps) {
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
  const searchExpanded = expandedPanel === "search";
  const filterExpanded = expandedPanel === "filter";
  const activeFilterCount = Number(occupancy !== "all") + Number(sort !== "asc");
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
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  useEffect(() => {
    if (searchValue.trim() === keyword.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applySearch(searchValue), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // The URL parameters are intentionally read when the debounced update runs.
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
  const closeExpandedPanel = () => {
    if (searchExpanded) closeSearch();
    else if (filterExpanded) closeFilter();
  };
  const toggleSearch = () => {
    if (searchExpanded) closeSearch();
    else setExpandedPanel("search");
  };
  const toggleFilter = () => {
    if (filterExpanded) closeFilter();
    else setExpandedPanel("filter");
  };
  const filterHref = (nextOccupancy: Occupancy, nextSort: Sort) => {
    const params = new URLSearchParams(currentSearchParams.toString());
    if (nextOccupancy === "all") params.delete("occupancy"); else params.set("occupancy", nextOccupancy);
    if (nextSort === "asc") params.delete("sort"); else params.set("sort", nextSort);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  return (
    <section className="shrink-0 space-y-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4" aria-label="เครื่องมือทะเบียนบ้าน">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold tracking-tight text-gray-900 sm:text-xl">ทะเบียนบ้าน</h1>
        <p className="mt-0.5 hidden truncate text-xs leading-5 text-gray-500 sm:block lg:text-sm">ค้นหาเลขบ้านและเปิดดูรายละเอียดของแต่ละครัวเรือน</p>
      </div>

      <div className="flex h-11 min-w-0 items-center gap-2" onKeyDown={(event) => {
        if (event.key === "Escape") closeExpandedPanel();
      }}>
        <button ref={searchButtonRef} type="button" aria-label="ค้นหาบ้านเลขที่" aria-expanded={searchExpanded} aria-controls={searchPanelId} onClick={toggleSearch} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1">
          <Search className="h-4 w-4" aria-hidden="true" />
        </button>
        {searchExpanded ? <form id={searchPanelId} role="search" onSubmit={(event) => { event.preventDefault(); if (debounceRef.current) clearTimeout(debounceRef.current); applySearch(searchValue); }} className="flex min-w-0 flex-1 items-center gap-1.5">
          <label htmlFor={searchInputId} className="sr-only">ค้นหาบ้านเลขที่</label>
          <input ref={searchInputRef} id={searchInputId} name="q" type="search" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} list={suggestions.length ? suggestionsId : undefined} placeholder="ค้นหาเลขบ้าน เช่น 99/1" className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none placeholder:text-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500" />
          <button type="button" onClick={closeSearch} aria-label="ปิดช่องค้นหา" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"><X className="h-4 w-4" aria-hidden="true" /></button>
          <button type="submit" className="sr-only">ค้นหา</button>
        </form> : <div id={searchPanelId} hidden />}

        <button ref={filterButtonRef} type="button" aria-label="ตัวกรอง" aria-expanded={filterExpanded} aria-controls={filterPanelId} onClick={toggleFilter} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1">
          <Filter className="h-4 w-4" aria-hidden="true" />
          <span className="hidden md:inline">ตัวกรอง</span>
          {activeFilterCount > 0 ? <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-green-600 px-1.5 text-xs font-semibold text-white">{activeFilterCount}</span> : null}
        </button>
        {filterExpanded ? <div id={filterPanelId} className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain rounded-lg border border-gray-200 bg-white px-2 py-1.5 [scrollbar-width:thin]"><div className="flex w-max items-center gap-2 whitespace-nowrap">
          <span className="text-xs font-semibold text-gray-500">เรียง</span>
          <FilterChip href={filterHref(occupancy, "asc")} active={sort === "asc"}>บ้านเลขที่น้อย → มาก</FilterChip>
          <FilterChip href={filterHref(occupancy, "desc")} active={sort === "desc"}>บ้านเลขที่มาก → น้อย</FilterChip>
          <span className="ml-1 text-xs font-semibold text-gray-500">สถานะข้อมูล</span>
          <FilterChip href={filterHref("all", sort)} active={occupancy === "all"}>ทั้งหมด</FilterChip>
          <FilterChip href={filterHref("withPeople", sort)} active={occupancy === "withPeople"}>มีคนในทะเบียน</FilterChip>
          <FilterChip href={filterHref("withoutPeople", sort)} active={occupancy === "withoutPeople"}>ไม่มีคนในทะเบียน</FilterChip>
          {activeFilterCount > 0 ? <Link href={filterHref("all", "asc")} className="ml-1 rounded-full px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100">ล้างตัวกรอง</Link> : null}
        </div></div> : <div id={filterPanelId} hidden />}
      </div>
      {suggestions.length ? <datalist id={suggestionsId}>{suggestions.map((value) => <option key={value} value={value} />)}</datalist> : null}
    </section>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return <Link href={href} className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", active ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>{children}</Link>;
}
