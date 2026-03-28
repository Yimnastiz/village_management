"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type SortValue = "date_desc" | "date_asc";

interface PublicTransparencyToolbarProps {
  villageSlug: string;
  villageName: string;
  keyword: string;
  sort: SortValue;
  suggestionTitles: string[];
}

const sortOptions: Array<{ value: SortValue; label: string }> = [
  { value: "date_desc", label: "ล่าสุดก่อน" },
  { value: "date_asc", label: "เก่าก่อน" },
];

function buildPublicTransparencyHref(params: {
  villageSlug: string;
  keyword: string;
  sort: SortValue;
}) {
  const query = new URLSearchParams();
  const trimmedKeyword = params.keyword.trim();

  if (params.sort !== "date_desc") {
    query.set("sort", params.sort);
  }

  if (trimmedKeyword) {
    query.set("q", trimmedKeyword);
  }

  const queryString = query.toString();
  const basePath = `/${params.villageSlug}/transparency`;
  return queryString ? `${basePath}?${queryString}` : basePath;
}

export function PublicTransparencyToolbar({
  villageSlug,
  villageName,
  keyword,
  sort,
  suggestionTitles,
}: PublicTransparencyToolbarProps) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(Boolean(keyword));
  const [searchKeyword, setSearchKeyword] = useState(keyword);

  useEffect(() => {
    setSearchKeyword(keyword);
  }, [keyword]);

  useEffect(() => {
    if (!searchOpen) return;

    const timeoutId = setTimeout(() => {
      router.push(
        buildPublicTransparencyHref({
          villageSlug,
          keyword: searchKeyword,
          sort,
        })
      );
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [searchKeyword, searchOpen, villageSlug, sort, router]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ความโปร่งใสหมู่บ้าน {villageName}</h1>
          <p className="text-gray-500">โครงการ งบประมาณ การจัดซื้อจัดจ้าง และการบริจาค</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
          aria-label="ค้นหาความโปร่งใส"
          onClick={() => setSearchOpen((currentValue) => !currentValue)}
        >
          <Search className="h-4 w-4" />
        </button>

        {searchOpen && (
          <input
            autoFocus
            list="public-transparency-title-suggestions"
            placeholder="พิมพ์หัวข้อ"
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            className="h-9 w-56 rounded-lg border border-gray-300 px-3 text-sm outline-none ring-green-600 placeholder:text-gray-400 focus:ring-1"
          />
        )}

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

        <datalist id="public-transparency-title-suggestions">
          {suggestionTitles.map((title) => (
            <option key={title} value={title} />
          ))}
        </datalist>

        <span className="ml-1 text-xs font-medium text-gray-500">เรียงตามวันที่:</span>
        {sortOptions.map((option) => (
          <Link
            key={option.value}
            href={buildPublicTransparencyHref({
              villageSlug,
              keyword: searchKeyword,
              sort: option.value,
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
  );
}
