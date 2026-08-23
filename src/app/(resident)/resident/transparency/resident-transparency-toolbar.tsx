"use client";
import Link from "next/link";
import { ResidentFilterDropdown, ResidentMultiFilterDropdown, ResidentPageToolbar } from "@/components/resident/resident-page-toolbar";
type VisibilityValue = "PUBLIC" | "RESIDENT_ONLY"; type SortValue = "date_desc" | "date_asc"; type Props = { keyword: string; selectedVisibilities: VisibilityValue[]; sort: SortValue; suggestionTitles: string[]; canViewResidentOnly: boolean };
function href({ visibilities, sort, keyword }: { visibilities: VisibilityValue[]; sort: SortValue; keyword: string }) { const query = new URLSearchParams(); const values = Array.from(new Set(visibilities)).sort(); if (values.length) query.set("visibility", values.join(",")); if (sort !== "date_desc") query.set("sort", sort); if (keyword.trim()) query.set("q", keyword.trim()); return query.size ? `/resident/transparency?${query}` : "/resident/transparency"; }
export function ResidentTransparencyToolbar({ keyword, selectedVisibilities, sort, suggestionTitles, canViewResidentOnly }: Props) {
  const has = (value: VisibilityValue) => selectedVisibilities.includes(value); const toggle = (value: VisibilityValue) => href({ visibilities: has(value) ? selectedVisibilities.filter((item) => item !== value) : [...selectedVisibilities, value], sort, keyword }); const count = canViewResidentOnly ? selectedVisibilities.length : 0;
  return <ResidentPageToolbar namespace="resident-transparency" title="ข้อมูลความโปร่งใส" registerHeader search={{ keyword, placeholder: "พิมพ์หัวข้อข้อมูลความโปร่งใส", label: "ค้นหาข้อมูลความโปร่งใส", suggestions: suggestionTitles }} activeFilterCount={count} filters={<>
    {canViewResidentOnly ? <ResidentMultiFilterDropdown label="การมองเห็น" clearHref={href({ visibilities: [], sort, keyword })} options={([['RESIDENT_ONLY', 'ข้อมูลในหมู่บ้าน'], ['PUBLIC', 'ข้อมูลสาธารณะ']] as const).map(([value, label]) => ({ label, href: toggle(value), active: has(value) }))} /> : null}
    <ResidentFilterDropdown label="เรียง" options={([['date_desc', 'ล่าสุดก่อน'], ['date_asc', 'เก่าสุดก่อน']] as const).map(([value, label]) => ({ label, href: href({ visibilities: selectedVisibilities, sort: value, keyword }), active: sort === value }))} />
    {count > 0 ? <Link href={href({ visibilities: [], sort, keyword })} className="inline-flex h-9 items-center rounded-md px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500">ล้างตัวกรอง</Link> : null}
  </>} />;
}
