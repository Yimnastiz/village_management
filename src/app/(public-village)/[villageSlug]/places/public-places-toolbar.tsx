"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { VILLAGE_PLACE_CATEGORY_LABELS } from "@/lib/constants";

type SortValue = "newest" | "oldest" | "name_asc" | "name_desc";

type PublicPlacesToolbarProps = {
  villageSlug: string;
  villageName: string;
  keyword: string;
  category: string;
  sort: SortValue;
  suggestionTitles: string[];
};

const sortOptions: Array<{ value: SortValue; label: string }> = [
  { value: "newest", label: "ล่าสุดก่อน" },
  { value: "oldest", label: "เก่าก่อน" },
  { value: "name_asc", label: "ชื่อ ก-ฮ" },
  { value: "name_desc", label: "ชื่อ ฮ-ก" },
];

function buildHref(params: {
  villageSlug: string;
  keyword: string;
  category: string;
  sort: SortValue;
}) {
  const query = new URLSearchParams();
  const trimmedKeyword = params.keyword.trim();

  if (trimmedKeyword) query.set("q", trimmedKeyword);
  if (params.category !== "ALL") query.set("category", params.category);
  if (params.sort !== "newest") query.set("sort", params.sort);

  const queryString = query.toString();
  const basePath = `/${params.villageSlug}/places`;
  return queryString ? `${basePath}?${queryString}` : basePath;
}

export function PublicPlacesToolbar({
  villageSlug,
  villageName,
  keyword,
  category,
  sort,
  suggestionTitles,
}: PublicPlacesToolbarProps) {
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
        buildHref({
          villageSlug,
          keyword: searchKeyword,
          category,
          sort,
        })
      );
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [searchKeyword, searchOpen, villageSlug, category, sort, router]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">สถานที่สำคัญในหมู่บ้าน {villageName}</h1>
      </div>

      <div className="mt-3 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
          aria-label="ค้นหาสถานที่"
          onClick={() => setSearchOpen((currentValue) => !currentValue)}
        >
          <Search className="h-4 w-4" />
        </button>

        {searchOpen && (
          <input
            autoFocus
            list="public-places-title-suggestions"
            placeholder="พิมพ์ชื่อสถานที่"
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

        <datalist id="public-places-title-suggestions">
          {suggestionTitles.map((title) => (
            <option key={title} value={title} />
          ))}
        </datalist>

        <span className="ml-1 text-xs font-medium text-gray-500">หมวดหมู่:</span>
        <Link
          href={buildHref({ villageSlug, keyword: searchKeyword, category: "ALL", sort })}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            category === "ALL" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          ทั้งหมด
        </Link>
        {Object.entries(VILLAGE_PLACE_CATEGORY_LABELS).map(([value, label]) => (
          <Link
            key={value}
            href={buildHref({ villageSlug, keyword: searchKeyword, category: value, sort })}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              category === value ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {label}
          </Link>
        ))}

        <span className="ml-1 text-xs font-medium text-gray-500">เรียงลำดับ:</span>
        {sortOptions.map((option) => (
          <Link
            key={option.value}
            href={buildHref({ villageSlug, keyword: searchKeyword, category, sort: option.value })}
            className={cn(
              "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
              sort === option.value ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {option.label}
          </Link>
        ))}

        <Link
          href={`/${villageSlug}/places`}
          className="inline-flex h-9 items-center rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-600 hover:bg-gray-100"
        >
          ล้างตัวกรอง
        </Link>
      </div>
    </div>
  );
}
