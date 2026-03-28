"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ISSUE_CATEGORY_LABELS, ISSUE_PRIORITY_LABELS } from "@/lib/constants";

type ScopeValue = "mine" | "others";
type SortValue = "date_desc" | "date_asc" | "priority_desc" | "priority_asc";

type PriorityFilterValue = "ALL" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type CategoryFilterValue =
  | "ALL"
  | "ROAD"
  | "WATER"
  | "ELECTRICITY"
  | "SECURITY"
  | "WASTE"
  | "ENVIRONMENT"
  | "PUBLIC_HEALTH"
  | "OTHER";

interface ResidentIssuesToolbarProps {
  keyword: string;
  selectedScopes: ScopeValue[];
  priorityFilter: PriorityFilterValue;
  categoryFilter: CategoryFilterValue;
  sort: string;
  suggestionTitles: string[];
}

const scopeOptions: Array<{ value: ScopeValue; label: string }> = [
  { value: "mine", label: "ปัญหาของฉัน" },
  { value: "others", label: "ปัญหาผู้อื่น" },
];

const sortOptions: Array<{ value: SortValue; label: string }> = [
  { value: "date_desc", label: "วันที่ใหม่ไปเก่า" },
  { value: "date_asc", label: "วันที่เก่าไปใหม่" },
  { value: "priority_desc", label: "ความสำคัญสูงไปต่ำ" },
  { value: "priority_asc", label: "ความสำคัญต่ำไปสูง" },
];

function buildIssuesHref(params: {
  scopes: ScopeValue[];
  sort: string;
  keyword: string;
  priority: PriorityFilterValue;
  category: CategoryFilterValue;
}) {
  const query = new URLSearchParams();

  const normalizedScopes = Array.from(new Set(params.scopes)).sort();
  if (normalizedScopes.length > 0) {
    query.set("scope", normalizedScopes.join(","));
  }

  if (params.priority !== "ALL") {
    query.set("priority", params.priority);
  }

  if (params.category !== "ALL") {
    query.set("category", params.category);
  }

  if (params.sort !== "date_desc") {
    query.set("sort", params.sort);
  }

  const trimmedKeyword = params.keyword.trim();
  if (trimmedKeyword) {
    query.set("q", trimmedKeyword);
  }

  const queryString = query.toString();
  return queryString ? `/resident/issues?${queryString}` : "/resident/issues";
}

export function ResidentIssuesToolbar({
  keyword,
  selectedScopes,
  priorityFilter,
  categoryFilter,
  sort,
  suggestionTitles,
}: ResidentIssuesToolbarProps) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(Boolean(keyword));

  const sortValue: SortValue =
    sort === "date_asc" || sort === "priority_desc" || sort === "priority_asc" ? sort : "date_desc";

  const scopeSet = useMemo(() => new Set(selectedScopes), [selectedScopes]);

  const getScopeToggleHref = (scopeToToggle: ScopeValue) => {
    const nextSet = new Set(scopeSet);

    if (nextSet.has(scopeToToggle)) {
      nextSet.delete(scopeToToggle);
    } else {
      nextSet.add(scopeToToggle);
    }

    return buildIssuesHref({
      scopes: Array.from(nextSet),
      sort: sortValue,
      keyword,
      priority: priorityFilter,
      category: categoryFilter,
    });
  };

  const goWithFilters = (next: {
    priority?: PriorityFilterValue;
    category?: CategoryFilterValue;
    sort?: SortValue;
  }) => {
    router.push(
      buildIssuesHref({
        scopes: selectedScopes,
        sort: next.sort ?? sortValue,
        keyword,
        priority: next.priority ?? priorityFilter,
        category: next.category ?? categoryFilter,
      })
    );
  };

  return (
    <div className="sticky top-16 z-30 -mx-6 border-b border-gray-200 bg-gray-50/95 px-6 pb-4 pt-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ปัญหา/คำร้อง</h1>
        </div>
        <Link href="/resident/issues/new">
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> แจ้งปัญหาใหม่
          </Button>
        </Link>
      </div>

      <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <form action="/resident/issues" className="flex items-center gap-2">
            <input type="hidden" name="scope" value={selectedScopes.join(",")} />
            <input type="hidden" name="priority" value={priorityFilter !== "ALL" ? priorityFilter : ""} />
            <input type="hidden" name="category" value={categoryFilter !== "ALL" ? categoryFilter : ""} />
            <input type="hidden" name="sort" value={sortValue} />

            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
              aria-label="ค้นหาปัญหา"
              onClick={() => setSearchOpen((currentValue) => !currentValue)}
            >
              <Search className="h-4 w-4" />
            </button>

            {searchOpen && (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  name="q"
                  list="resident-issue-title-suggestions"
                  placeholder="พิมพ์ชื่อปัญหา"
                  defaultValue={keyword}
                  className="h-9 w-56 rounded-lg border border-gray-300 px-3 text-sm outline-none ring-green-600 placeholder:text-gray-400 focus:ring-1"
                />
                <Button type="submit" size="sm">ค้นหา</Button>
              </div>
            )}
          </form>

          {searchOpen && (
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100"
              aria-label="ปิดค้นหา"
              onClick={() => setSearchOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <datalist id="resident-issue-title-suggestions">
            {suggestionTitles.map((title) => (
              <option key={title} value={title} />
            ))}
          </datalist>

          <span className="ml-1 text-xs font-medium text-gray-500">ขอบเขต:</span>
          {scopeOptions.map((option) => (
            <Link
              key={option.value}
              href={getScopeToggleHref(option.value)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                scopeSet.has(option.value)
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {option.label}
            </Link>
          ))}

          <label htmlFor="resident-issues-priority" className="ml-1 text-xs font-medium text-gray-500">
            ระดับความสำคัญ:
          </label>
          <select
            id="resident-issues-priority"
            value={priorityFilter}
            onChange={(event) => goWithFilters({ priority: event.target.value as PriorityFilterValue })}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-xs text-gray-700"
          >
            <option value="ALL">ทั้งหมด</option>
            {Object.entries(ISSUE_PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <label htmlFor="resident-issues-category" className="ml-1 text-xs font-medium text-gray-500">
            หมวดหมู่:
          </label>
          <select
            id="resident-issues-category"
            value={categoryFilter}
            onChange={(event) => goWithFilters({ category: event.target.value as CategoryFilterValue })}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-xs text-gray-700"
          >
            <option value="ALL">ทั้งหมด</option>
            {Object.entries(ISSUE_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <label htmlFor="resident-issues-sort" className="ml-1 text-xs font-medium text-gray-500">
            เรียงลำดับ:
          </label>
          <select
            id="resident-issues-sort"
            value={sortValue}
            onChange={(event) => goWithFilters({ sort: event.target.value as SortValue })}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-xs text-gray-700"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <Link
            href="/resident/issues"
            className="inline-flex h-9 items-center rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            ล้างตัวกรอง
          </Link>
        </div>
      </div>
    </div>
  );
}
