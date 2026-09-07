"use client";

import { PublicPageToolbar } from "@/components/public/public-page-toolbar";
import { ResidentFilterDropdown } from "@/components/resident/resident-page-toolbar";
import { VILLAGE_PLACE_CATEGORY_LABELS } from "@/lib/constants";

type SortValue = "name_asc" | "name_desc";
type Props = { villageSlug: string; keyword: string; category: string; featured: boolean; sort: SortValue; suggestionTitles: string[] };

function href(villageSlug: string, keyword: string, category: string, featured: boolean, sort: SortValue) {
  const params = new URLSearchParams();
  if (keyword.trim()) params.set("q", keyword.trim());
  if (category !== "ALL") params.set("category", category);
  if (featured) params.set("featured", "1");
  if (sort !== "name_asc") params.set("sort", sort);
  const query = params.toString();
  return query ? `/${villageSlug}/places?${query}` : `/${villageSlug}/places`;
}

export function PublicPlacesToolbar({ villageSlug, keyword, category, featured, sort, suggestionTitles }: Props) {
  const categoryOptions = [
    { label: "ทั้งหมด", value: "ALL" },
    ...Object.entries(VILLAGE_PLACE_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
  ];
  return <PublicPageToolbar namespace="public-places" keyword={keyword} placeholder="ค้นหาสถานที่" suggestions={suggestionTitles} activeFilterCount={Number(category !== "ALL") + Number(featured) + Number(sort !== "name_asc")} filters={<>
    <ResidentFilterDropdown label="หมวดหมู่" options={categoryOptions.map((option) => ({ label: option.label, href: href(villageSlug, keyword, option.value, featured, sort), active: category === option.value }))} />
    <ResidentFilterDropdown label="ความสำคัญ" options={[
      { label: "ทั้งหมด", href: href(villageSlug, keyword, category, false, sort), active: !featured },
      { label: "สถานที่สำคัญ", href: href(villageSlug, keyword, category, true, sort), active: featured },
    ]} />
    <ResidentFilterDropdown label="เรียง" options={[
      { label: "ชื่อ ก-ฮ", href: href(villageSlug, keyword, category, featured, "name_asc"), active: sort === "name_asc" },
      { label: "ชื่อ ฮ-ก", href: href(villageSlug, keyword, category, featured, "name_desc"), active: sort === "name_desc" },
    ]} />
  </>} />;
}
