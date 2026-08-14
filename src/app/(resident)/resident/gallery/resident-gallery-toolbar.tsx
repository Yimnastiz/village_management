"use client";

import Link from "next/link";
import { NewsFilterChip } from "@/components/news/news-toolbar";
import { ResidentPageToolbar } from "@/components/resident/resident-page-toolbar";

type Sort = "newest" | "oldest";
type Visibility = "PUBLIC" | "RESIDENT_ONLY";
type Props = { keyword: string; sort: Sort; villageName: string; selectedVisibilities: Visibility[]; allowSubmissionsOnly: boolean; suggestionTitles: string[]; canSubmit: boolean; hasResidentAccess: boolean };
function makeHref(keyword: string, sort: Sort, visibilities: Visibility[], allowSubmissionsOnly: boolean, hasResidentAccess: boolean) { const query = new URLSearchParams(); if (hasResidentAccess && visibilities.length) query.set("visibility", [...new Set(visibilities)].sort().join(",")); if (hasResidentAccess && allowSubmissionsOnly) query.set("allowSubmissions", "1"); if (sort !== "newest") query.set("sort", sort); if (keyword.trim()) query.set("q", keyword.trim()); return query.size ? `/resident/gallery?${query}` : "/resident/gallery"; }

export function ResidentGalleryToolbar({ keyword, sort, villageName, selectedVisibilities, allowSubmissionsOnly, suggestionTitles, canSubmit, hasResidentAccess }: Props) {
  const has = (value: Visibility) => selectedVisibilities.includes(value);
  const toggle = (value: Visibility) => makeHref(keyword, sort, has(value) ? selectedVisibilities.filter((item) => item !== value) : [...selectedVisibilities, value], allowSubmissionsOnly, hasResidentAccess);
  const activeFilterCount = Number(sort !== "newest") + (hasResidentAccess ? selectedVisibilities.length + Number(allowSubmissionsOnly) : 0);
  return <ResidentPageToolbar namespace="resident-gallery" title="แกลเลอรีภาพ" description={`ภาพกิจกรรมและบรรยากาศของ ${villageName}`} actions={canSubmit ? <Link href="/resident/gallery/requests" className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">คำขอของฉัน</Link> : null} search={{ keyword, placeholder: "พิมพ์ชื่ออัลบั้ม", label: "ค้นหาอัลบั้ม", suggestions: suggestionTitles }} activeFilterCount={activeFilterCount} filters={<>{hasResidentAccess ? <><span className="text-xs font-semibold text-gray-500">การมองเห็น</span>{([['PUBLIC', 'สาธารณะ'], ['RESIDENT_ONLY', 'เฉพาะลูกบ้าน']] as const).map(([value, label]) => <NewsFilterChip key={value} href={toggle(value)} active={has(value)}>{label}</NewsFilterChip>)}<NewsFilterChip href={makeHref(keyword, sort, selectedVisibilities, !allowSubmissionsOnly, hasResidentAccess)} active={allowSubmissionsOnly}>ส่งรูปเพิ่มได้</NewsFilterChip></> : null}<span className="ml-1 text-xs font-semibold text-gray-500">เรียง</span>{([['newest', 'ล่าสุดก่อน'], ['oldest', 'เก่าก่อน']] as const).map(([value, label]) => <NewsFilterChip key={value} href={makeHref(keyword, value, selectedVisibilities, allowSubmissionsOnly, hasResidentAccess)} active={sort === value}>{label}</NewsFilterChip>)}{activeFilterCount ? <NewsFilterChip href="/resident/gallery" active={false}>ล้างตัวกรอง</NewsFilterChip> : null}</>} />;
}
