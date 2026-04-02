"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type SortValue = "newest" | "oldest";
type SourceValue = "all" | "admin" | "resident";

interface PublicNewsToolbarProps {
  villageSlug: string;
  villageName: string;
  keyword: string;
  sort: SortValue;
  source: SourceValue;
  suggestionTitles: string[];
}

const sortOptions: Array<{ value: SortValue; label: string }> = [
  { value: "newest", label: "ล่าสุดก่อน" },
  { value: "oldest", label: "เก่าก่อน" },
];

const sourceOptions: Array<{ value: SourceValue; label: string }> = [
  { value: "all", label: "ทั้งหมด" },
  { value: "admin", label: "จากแอดมิน" },
  { value: "resident", label: "จากลูกบ้าน" },
];

function buildPublicNewsHref(params: {
  villageSlug: string;
  keyword: string;
  sort: SortValue;
  source: SourceValue;
}) {
  const query = new URLSearchParams();
  const trimmedKeyword = params.keyword.trim();

  if (params.sort !== "newest") {
    query.set("sort", params.sort);
  }

  if (params.source !== "all") {
    query.set("source", params.source);
  }

  if (trimmedKeyword) {
    query.set("q", trimmedKeyword);
  }

  const queryString = query.toString();
  const basePath = `/${params.villageSlug}/news`;
  return queryString ? `${basePath}?${queryString}` : basePath;
}

export function PublicNewsToolbar({ villageSlug, villageName, keyword, sort, source, suggestionTitles }: PublicNewsToolbarProps) {
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
        buildPublicNewsHref({
          villageSlug,
          keyword: searchKeyword,
          sort,
          source,
        })
      );
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [searchKeyword, searchOpen, villageSlug, sort, source, router]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">ข่าวสารหมู่บ้าน {villageName}</h1>
      </div>

      <div className="mt-3 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
          aria-label="ค้นหาข่าว"
          onClick={() => setSearchOpen((currentValue) => !currentValue)}
        >
          <Search className="h-4 w-4" />
        </button>

        {searchOpen && (
          <input
            autoFocus
            list="public-news-title-suggestions"
            placeholder="พิมพ์ชื่อข่าว"
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

        <datalist id="public-news-title-suggestions">
          {suggestionTitles.map((title) => (
            <option key={title} value={title} />
          ))}
        </datalist>

        <span className="ml-1 text-xs font-medium text-gray-500">เรียงลำดับ:</span>
        {sortOptions.map((option) => (
          <Link
            key={option.value}
            href={buildPublicNewsHref({
              villageSlug,
              keyword: searchKeyword,
              sort: option.value,
              source,
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

        <span className="ml-1 text-xs font-medium text-gray-500">แหล่งข่าว:</span>
        {sourceOptions.map((option) => (
          <Link
            key={option.value}
            href={buildPublicNewsHref({
              villageSlug,
              keyword: searchKeyword,
              sort,
              source: option.value,
            })}
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

        <Link
          href={buildPublicNewsHref({ villageSlug, keyword: "", sort: "newest", source: "all" })}
          className="inline-flex h-9 items-center rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-600 hover:bg-gray-100"
        >
          ล้างตัวกรอง
        </Link>
      </div>
    </div>
  );
}
