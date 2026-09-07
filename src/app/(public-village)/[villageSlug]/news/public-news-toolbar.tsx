"use client";

import { PublicPageToolbar } from "@/components/public/public-page-toolbar";
import { ResidentFilterDropdown } from "@/components/resident/resident-page-toolbar";

type SortValue = "newest" | "oldest";
type Props = { villageSlug: string; keyword: string; sort: SortValue; suggestionTitles: string[] };

function href(villageSlug: string, keyword: string, sort: SortValue) {
  const params = new URLSearchParams();
  if (keyword.trim()) params.set("q", keyword.trim());
  if (sort !== "newest") params.set("sort", sort);
  const query = params.toString();
  return query ? `/${villageSlug}/news?${query}` : `/${villageSlug}/news`;
}

export function PublicNewsToolbar({ villageSlug, keyword, sort, suggestionTitles }: Props) {
  return <PublicPageToolbar
    namespace="public-news"
    keyword={keyword}
    placeholder="ค้นหาข่าวสาร"
    suggestions={suggestionTitles}
    activeFilterCount={Number(sort !== "newest")}
    filters={<ResidentFilterDropdown label="เรียง" options={[
      { label: "ล่าสุดก่อน", href: href(villageSlug, keyword, "newest"), active: sort === "newest" },
      { label: "เก่าสุดก่อน", href: href(villageSlug, keyword, "oldest"), active: sort === "oldest" },
    ]} />}
  />;
}
