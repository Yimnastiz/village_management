"use client";
import Link from "next/link";
import { ResidentFilterDropdown, ResidentMultiFilterDropdown, ResidentPageToolbar } from "@/components/resident/resident-page-toolbar";
import { DOWNLOAD_CATEGORY_LABELS } from "@/lib/downloads/constants";
type Visibility = "PUBLIC" | "RESIDENT_ONLY"; type Sort = "newest" | "oldest";
type Props = { keyword: string; category: string; categories: string[]; selectedVisibilities: Visibility[]; sort: Sort; suggestionTitles: string[]; hasResidentAccess: boolean };
function makeHref(category: string, visibilities: Visibility[], sort: Sort, keyword: string, hasResidentAccess: boolean) { const query = new URLSearchParams(); if (category) query.set("category", category); if (hasResidentAccess && visibilities.length) query.set("visibility", [...new Set(visibilities)].sort().join(",")); if (sort !== "newest") query.set("sort", sort); if (keyword.trim()) query.set("q", keyword.trim()); return query.size ? `/resident/downloads?${query}` : "/resident/downloads"; }
export function ResidentDownloadsToolbar({ keyword, category, categories, selectedVisibilities, sort, suggestionTitles, hasResidentAccess }: Props) {
  const visibilitySet = new Set(selectedVisibilities); const toggle = (value: Visibility) => makeHref(category, visibilitySet.has(value) ? selectedVisibilities.filter((item) => item !== value) : [...selectedVisibilities, value], sort, keyword, hasResidentAccess); const count = Number(Boolean(category)) + (hasResidentAccess ? selectedVisibilities.length : 0);
  return <ResidentPageToolbar namespace="resident-downloads" title="ดาวน์โหลด" registerHeader search={{ keyword, placeholder: "พิมพ์ชื่อเอกสาร", label: "ค้นหาเอกสาร", suggestions: suggestionTitles }} activeFilterCount={count} filters={<>
    <ResidentFilterDropdown label="หมวดหมู่" options={[{ label: "ทั้งหมด", href: makeHref("", selectedVisibilities, sort, keyword, hasResidentAccess), active: !category }, ...categories.map((value) => ({ label: DOWNLOAD_CATEGORY_LABELS[value] ?? value, href: makeHref(value, selectedVisibilities, sort, keyword, hasResidentAccess), active: category === value }))]} />
    {hasResidentAccess ? <ResidentMultiFilterDropdown label="การมองเห็น" clearHref={makeHref(category, [], sort, keyword, hasResidentAccess)} options={([['RESIDENT_ONLY', 'ลูกบ้าน'], ['PUBLIC', 'สาธารณะ']] as const).map(([value, label]) => ({ label, href: toggle(value), active: visibilitySet.has(value) }))} /> : null}
    <ResidentFilterDropdown label="เรียง" options={([['newest', 'ล่าสุดก่อน'], ['oldest', 'เก่าสุดก่อน']] as const).map(([value, label]) => ({ label, href: makeHref(category, selectedVisibilities, value, keyword, hasResidentAccess), active: sort === value }))} />
    {count > 0 ? <Link href={makeHref("", [], sort, keyword, hasResidentAccess)} className="inline-flex h-9 items-center rounded-md px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500">ล้างตัวกรอง</Link> : null}
  </>} />;
}
