"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ResidentPageToolbar } from "@/components/resident/resident-page-toolbar";

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
  { value: "oldest", label: "เก่าสุดก่อน" },
];

const sourceOptions: Array<{ value: SourceValue; label: string }> = [
  { value: "all", label: "ทั้งหมด" },
  { value: "admin", label: "จากผู้ดูแล" },
  { value: "resident", label: "จากลูกบ้าน" },
];

function buildPublicNewsHref(params: { villageSlug: string; keyword: string; sort: SortValue; source: SourceValue }) {
  const query = new URLSearchParams();
  if (params.sort !== "newest") query.set("sort", params.sort);
  if (params.source !== "all") query.set("source", params.source);
  if (params.keyword.trim()) query.set("q", params.keyword.trim());
  const queryString = query.toString();
  return queryString ? `/${params.villageSlug}/news?${queryString}` : `/${params.villageSlug}/news`;
}

/** Public-news variant of the shared resident list toolbar. All options only refine public news. */
export function PublicNewsToolbar({ villageSlug, villageName, keyword, sort, source, suggestionTitles }: PublicNewsToolbarProps) {
  const chipClass = (active: boolean) => cn(
    "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
    active ? "bg-green-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
  );
  const href = (nextSort: SortValue, nextSource: SourceValue) =>
    buildPublicNewsHref({ villageSlug, keyword, sort: nextSort, source: nextSource });

  return (
    <ResidentPageToolbar
      namespace="public-news"
      title={`ข่าวสาร ${villageName}`}
      description="ค้นหาและกรองเฉพาะข่าวสารที่เผยแพร่สาธารณะ"
      search={{ keyword, placeholder: "ค้นหาข้อมูลหมู่บ้าน", label: "ค้นหาข่าวสาธารณะ", suggestions: suggestionTitles }}
      activeFilterCount={Number(sort !== "newest") + Number(source !== "all")}
      filters={<>
        <span className="text-xs font-semibold text-gray-500">ข้อมูลสาธารณะ</span>
        {sourceOptions.map((option) => <Link key={option.value} href={href(sort, option.value)} className={chipClass(source === option.value)}>{option.label}</Link>)}
        <span className="ml-1 text-xs font-semibold text-gray-500">เรียง</span>
        {sortOptions.map((option) => <Link key={option.value} href={href(option.value, source)} className={chipClass(sort === option.value)}>{option.label}</Link>)}
        <Link href={`/${villageSlug}/news`} className={chipClass(false)}>ล้างตัวกรอง</Link>
      </>}
    />
  );
}
