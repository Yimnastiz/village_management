"use client";

import { PublicPageToolbar } from "@/components/public/public-page-toolbar";
import { ResidentFilterDropdown } from "@/components/resident/resident-page-toolbar";

type SortValue = "newest" | "oldest";
type SourceValue = "all" | "headman" | "resident";
type Props = { villageSlug: string; keyword: string; sort: SortValue; source: SourceValue; suggestionTitles: string[] };

function href(villageSlug: string, keyword: string, sort: SortValue, source: SourceValue) {
  const params = new URLSearchParams();
  if (keyword.trim()) params.set("q", keyword.trim());
  if (sort !== "newest") params.set("sort", sort);
  if (source !== "all") params.set("source", source);
  const query = params.toString();
  return query ? `/${villageSlug}/news?${query}` : `/${villageSlug}/news`;
}

export function PublicNewsToolbar({ villageSlug, keyword, sort, source, suggestionTitles }: Props) {
  return <PublicPageToolbar
    namespace="public-news"
    keyword={keyword}
    placeholder="ค้นหาข่าวสาร"
    suggestions={suggestionTitles}
    activeFilterCount={Number(sort !== "newest") + Number(source !== "all")}
    filters={<><ResidentFilterDropdown label="เรียง" options={[
      { label: "ล่าสุดก่อน", href: href(villageSlug, keyword, "newest", source), active: sort === "newest" },
      { label: "เก่าสุดก่อน", href: href(villageSlug, keyword, "oldest", source), active: sort === "oldest" },
    ]} /><ResidentFilterDropdown label="แหล่งที่มา" options={[
      { label: "ทั้งหมด", href: href(villageSlug, keyword, sort, "all"), active: source === "all" },
      { label: "ผู้ใหญ่บ้าน", href: href(villageSlug, keyword, sort, "headman"), active: source === "headman" },
      { label: "สมาชิก", href: href(villageSlug, keyword, sort, "resident"), active: source === "resident" },
    ]} /></>}
  />;
}
