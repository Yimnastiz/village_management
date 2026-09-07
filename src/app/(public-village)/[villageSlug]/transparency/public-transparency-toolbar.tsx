"use client";

import { PublicPageToolbar } from "@/components/public/public-page-toolbar";
import { ResidentFilterDropdown } from "@/components/resident/resident-page-toolbar";

type SortValue = "date_desc" | "date_asc";
type Props = { villageSlug: string; keyword: string; sort: SortValue; suggestionTitles: string[] };

function href(villageSlug: string, keyword: string, sort: SortValue) {
  const params = new URLSearchParams();
  if (keyword.trim()) params.set("q", keyword.trim());
  if (sort !== "date_desc") params.set("sort", sort);
  const query = params.toString();
  return query ? `/${villageSlug}/transparency?${query}` : `/${villageSlug}/transparency`;
}

export function PublicTransparencyToolbar({ villageSlug, keyword, sort, suggestionTitles }: Props) {
  return <PublicPageToolbar namespace="public-transparency" keyword={keyword} placeholder="ค้นหาเอกสารความโปร่งใส" suggestions={suggestionTitles} activeFilterCount={Number(sort !== "date_desc")} filters={<ResidentFilterDropdown label="เรียง" options={[
    { label: "ล่าสุดก่อน", href: href(villageSlug, keyword, "date_desc"), active: sort === "date_desc" },
    { label: "เก่าสุดก่อน", href: href(villageSlug, keyword, "date_asc"), active: sort === "date_asc" },
  ]} />} />;
}
