"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type SortValue = "newest" | "oldest";

interface PublicGalleryToolbarProps {
  villageSlug: string;
  villageName: string;
  keyword: string;
  sort: SortValue;
  suggestionTitles: string[];
}

const sortOptions: Array<{ value: SortValue; label: string }> = [
  { value: "newest", label: "ล่าสุดก่อน" },
  { value: "oldest", label: "เก่าก่อน" },
];

function buildPublicGalleryHref(params: {
  villageSlug: string;
  keyword: string;
  sort: SortValue;
}) {
  const query = new URLSearchParams();
  const trimmedKeyword = params.keyword.trim();

  if (params.sort !== "newest") {
    query.set("sort", params.sort);
  }

  if (trimmedKeyword) {
    query.set("q", trimmedKeyword);
  }

  const queryString = query.toString();
  const basePath = `/${params.villageSlug}/gallery`;
  return queryString ? `${basePath}?${queryString}` : basePath;
}

export function PublicGalleryToolbar({
  villageSlug,
  villageName,
  keyword,
  sort,
  suggestionTitles,
}: PublicGalleryToolbarProps) {
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
        buildPublicGalleryHref({
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
          <h1 className="text-2xl font-bold text-gray-900">แกลเลอรีภาพ</h1>
          <p className="mt-1 text-sm text-gray-500">ภาพกิจกรรมและบรรยากาศของ {villageName}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
          aria-label="ค้นหาอัลบั้มสาธารณะ"
          onClick={() => setSearchOpen((currentValue) => !currentValue)}
        >
          <Search className="h-4 w-4" />
        </button>

        {searchOpen && (
          <input
            autoFocus
            list="public-gallery-title-suggestions"
            placeholder="พิมพ์ชื่ออัลบั้ม"
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

        <datalist id="public-gallery-title-suggestions">
          {suggestionTitles.map((title) => (
            <option key={title} value={title} />
          ))}
        </datalist>

        <span className="ml-1 text-xs font-medium text-gray-500">เรียงตามวันที่:</span>
        {sortOptions.map((option) => (
          <Link
            key={option.value}
            href={buildPublicGalleryHref({
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
