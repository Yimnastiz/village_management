"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NewsSource = "resident" | "admin";
type NewsVisibilityValue = "PUBLIC" | "RESIDENT_ONLY";
type NewsSort = "newest" | "oldest";
type SourceValue = "all" | NewsSource;

interface ResidentNewsToolbarProps {
  keyword: string;
  source: SourceValue;
  selectedVisibilities: NewsVisibilityValue[];
  sort: NewsSort;
  suggestionTitles: string[];
}

const sourceOptions: Array<{ value: SourceValue; label: string }> = [
  { value: "all", label: "ทั้งหมด" },
  { value: "admin", label: "จากแอดมิน" },
  { value: "resident", label: "จากลูกบ้าน" },
];

const sortOptions: Array<{ value: NewsSort; label: string }> = [
  { value: "newest", label: "ล่าสุดก่อน" },
  { value: "oldest", label: "เก่าก่อน" },
];

const visibilityOptions: Array<{ value: NewsVisibilityValue; label: string }> = [
  { value: "PUBLIC", label: "สาธารณะ" },
  { value: "RESIDENT_ONLY", label: "ภายในหมู่บ้าน" },
];

function buildNewsHref(
  nextSource: SourceValue,
  nextVisibilities: NewsVisibilityValue[],
  nextSort: NewsSort,
  nextKeyword: string
) {
  const params = new URLSearchParams();
  const trimmedKeyword = nextKeyword.trim();
  const normalizedVisibilities = Array.from(new Set(nextVisibilities)).sort();

  if (nextSource !== "all") {
    params.set("source", nextSource);
  }

  if (normalizedVisibilities.length > 0) {
    params.set("visibility", normalizedVisibilities.join(","));
  }

  if (nextSort !== "newest") {
    params.set("sort", nextSort);
  }

  if (trimmedKeyword) {
    params.set("q", trimmedKeyword);
  }

  const queryString = params.toString();
  return queryString ? `/resident/news?${queryString}` : "/resident/news";
}

export function ResidentNewsToolbar({
  keyword,
  source,
  selectedVisibilities,
  sort,
  suggestionTitles,
}: ResidentNewsToolbarProps) {
  const [searchOpen, setSearchOpen] = useState(Boolean(keyword));

  const visibilitySet = useMemo(() => new Set(selectedVisibilities), [selectedVisibilities]);

  const getVisibilityToggleHref = (visibilityToToggle: NewsVisibilityValue) => {
    const nextSet = new Set(visibilitySet);

    if (nextSet.has(visibilityToToggle)) {
      nextSet.delete(visibilityToToggle);
    } else {
      nextSet.add(visibilityToToggle);
    }

    return buildNewsHref(source, Array.from(nextSet), sort, keyword);
  };

  return (
    <div className="sticky top-16 z-30 -mx-6 border-b border-gray-200 bg-gray-50/95 px-6 pb-4 pt-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">ข่าว/ประกาศ</h1>
        <div className="flex items-center gap-2">
          <Link href="/resident/news/requests">
            <Button size="sm" variant="outline">คำขอของฉัน</Button>
          </Link>
          <Link href="/resident/news/requests/new">
            <Button size="sm">ขอเพิ่มข่าว</Button>
          </Link>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <form action="/resident/news" className="flex items-center gap-2">
            <input
              type="hidden"
              name="source"
              value={source === "all" ? "" : source}
            />
            <input type="hidden" name="visibility" value={selectedVisibilities.join(",")} />
            <input type="hidden" name="sort" value={sort} />

            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
              aria-label="ค้นหาข่าว"
              onClick={() => setSearchOpen((currentValue) => !currentValue)}
            >
              <Search className="h-4 w-4" />
            </button>

            {searchOpen && (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  name="q"
                  list="resident-news-title-suggestions"
                  placeholder="พิมพ์ชื่อข่าว"
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

          <datalist id="resident-news-title-suggestions">
            {suggestionTitles.map((title) => (
              <option key={title} value={title} />
            ))}
          </datalist>

          <span className="ml-1 text-xs font-medium text-gray-500">แหล่งข่าว:</span>
          {sourceOptions.map((option) => (
            <Link
              key={option.value}
              href={buildNewsHref(option.value, selectedVisibilities, sort, keyword)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                source === option.value
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {option.label}
            </Link>
          ))}
          <span className="ml-1 text-xs font-medium text-gray-500">การมองเห็น:</span>
          {visibilityOptions.map((option) => (
            <Link
              key={option.value}
              href={getVisibilityToggleHref(option.value)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                visibilitySet.has(option.value)
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {option.label}
            </Link>
          ))}
          <span className="ml-1 text-xs font-medium text-gray-500">เรียงลำดับ:</span>
          {sortOptions.map((option) => (
            <Link
              key={option.value}
              href={buildNewsHref(source, selectedVisibilities, option.value, keyword)}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                sort === option.value
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {option.label}
            </Link>
          ))}
          <Link
            href="/resident/news"
            className="inline-flex h-9 items-center rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            ล้างตัวกรอง
          </Link>
        </div>
      </div>
    </div>
  );
}
