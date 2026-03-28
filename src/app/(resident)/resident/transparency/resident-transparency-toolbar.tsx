"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type VisibilityValue = "PUBLIC" | "RESIDENT_ONLY";
type SortValue = "date_desc" | "date_asc";

interface ResidentTransparencyToolbarProps {
  keyword: string;
  selectedVisibilities: VisibilityValue[];
  sort: SortValue;
  suggestionTitles: string[];
}

const visibilityOptions: Array<{ value: VisibilityValue; label: string }> = [
  { value: "RESIDENT_ONLY", label: "ข้อมูลในหมู่บ้าน" },
  { value: "PUBLIC", label: "ข้อมูลสาธารณะ" },
];

const sortOptions: Array<{ value: SortValue; label: string }> = [
  { value: "date_desc", label: "ล่าสุดก่อน" },
  { value: "date_asc", label: "เก่าก่อน" },
];

function buildTransparencyHref(params: {
  visibilities: VisibilityValue[];
  sort: SortValue;
  keyword: string;
}) {
  const query = new URLSearchParams();
  const normalizedVisibilities = Array.from(new Set(params.visibilities)).sort();
  const trimmedKeyword = params.keyword.trim();

  if (normalizedVisibilities.length > 0) {
    query.set("visibility", normalizedVisibilities.join(","));
  }

  if (params.sort !== "date_desc") {
    query.set("sort", params.sort);
  }

  if (trimmedKeyword) {
    query.set("q", trimmedKeyword);
  }

  const queryString = query.toString();
  return queryString ? `/resident/transparency?${queryString}` : "/resident/transparency";
}

export function ResidentTransparencyToolbar({
  keyword,
  selectedVisibilities,
  sort,
  suggestionTitles,
}: ResidentTransparencyToolbarProps) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(Boolean(keyword));
  const [searchKeyword, setSearchKeyword] = useState(keyword);

  const visibilitySet = useMemo(() => new Set(selectedVisibilities), [selectedVisibilities]);

  useEffect(() => {
    setSearchKeyword(keyword);
  }, [keyword]);

  useEffect(() => {
    if (!searchOpen) return;

    const timeoutId = setTimeout(() => {
      router.push(
        buildTransparencyHref({
          visibilities: selectedVisibilities,
          sort,
          keyword: searchKeyword,
        })
      );
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [searchKeyword, searchOpen, selectedVisibilities, sort, router]);

  const getVisibilityToggleHref = (visibilityToToggle: VisibilityValue) => {
    const nextSet = new Set(visibilitySet);

    if (nextSet.has(visibilityToToggle)) {
      nextSet.delete(visibilityToToggle);
    } else {
      nextSet.add(visibilityToToggle);
    }

    return buildTransparencyHref({
      visibilities: Array.from(nextSet),
      sort,
      keyword: searchKeyword,
    });
  };

  return (
    <div className="sticky top-16 z-30 -mx-6 border-b border-gray-200 bg-gray-50/95 px-6 pb-4 pt-3 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">ความโปร่งใส</h1>
      </div>

      <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <button
            type="button"
            className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 p-0 text-gray-600 hover:bg-gray-100"
            aria-label="ค้นหาความโปร่งใส"
            onClick={() => setSearchOpen((currentValue) => !currentValue)}
          >
            <Search className="h-4 w-4" />
          </button>

          {searchOpen && (
            <input
              autoFocus
              name="q"
              list="resident-transparency-title-suggestions"
              placeholder="พิมพ์หัวข้อความโปร่งใส"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              className="h-9 w-56 rounded-lg border border-gray-300 px-3 text-sm outline-none ring-green-600 placeholder:text-gray-400 focus:ring-1"
            />
          )}

          {searchOpen && (
            <button
              type="button"
              className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 p-0 text-gray-500 hover:bg-gray-100"
              aria-label="ปิดค้นหา"
              onClick={() => setSearchOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <datalist id="resident-transparency-title-suggestions">
            {suggestionTitles.map((title) => (
              <option key={title} value={title} />
            ))}
          </datalist>

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

          <span className="ml-1 text-xs font-medium text-gray-500">เรียงตามวันที่:</span>
          {sortOptions.map((option) => (
            <Link
              key={option.value}
              href={buildTransparencyHref({
                visibilities: selectedVisibilities,
                sort: option.value,
                keyword: searchKeyword,
              })}
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
        </div>
      </div>
    </div>
  );
}
