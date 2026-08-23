"use client";

import Link from "next/link";
import { FilePlus2, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResidentFilterDropdown, ResidentMultiFilterDropdown, ResidentPageToolbar } from "@/components/resident/resident-page-toolbar";

type Visibility = "PUBLIC" | "RESIDENT_ONLY";
type Sort = "newest" | "oldest";
type Source = "all" | "resident" | "admin";
type Props = { keyword: string; source: Source; selectedVisibilities: Visibility[]; sort: Sort; suggestionTitles: string[]; canSubmit: boolean; hasResidentAccess: boolean };

function makeHref(source: Source, visibilities: Visibility[], sort: Sort, keyword: string, hasResidentAccess: boolean) {
  const params = new URLSearchParams();
  if (source !== "all") params.set("source", source);
  if (hasResidentAccess && visibilities.length) params.set("visibility", [...new Set(visibilities)].sort().join(","));
  if (sort !== "newest") params.set("sort", sort);
  if (keyword.trim()) params.set("q", keyword.trim());
  return params.size ? `/resident/news?${params}` : "/resident/news";
}

export function ResidentNewsToolbar({ keyword, source, selectedVisibilities, sort, suggestionTitles, canSubmit, hasResidentAccess }: Props) {
  const visibilitySet = new Set(selectedVisibilities);
  const toggleVisibility = (value: Visibility) => makeHref(source, visibilitySet.has(value) ? selectedVisibilities.filter((item) => item !== value) : [...selectedVisibilities, value], sort, keyword, hasResidentAccess);
  const activeFilterCount = Number(source !== "all") + (hasResidentAccess ? selectedVisibilities.length : 0);
  const clearHref = makeHref("all", [], sort, keyword, hasResidentAccess);

  return <ResidentPageToolbar namespace="resident-news" title="ข่าวสาร" description="ข่าวสารและประกาศล่าสุดของหมู่บ้าน" registerHeader search={{ keyword, placeholder: "ค้นหาชื่อข่าว", label: "ค้นหาข่าว", suggestions: suggestionTitles }} activeFilterCount={activeFilterCount} actions={canSubmit ? <><Link href="/resident/news/requests" aria-label="คำขอข่าวของฉัน"><Button size="sm" variant="outline" className="h-10 px-2 sm:px-3"><ListChecks className="h-4 w-4" /><span className="hidden sm:ml-1.5 sm:inline">คำขอของฉัน</span></Button></Link><Link href="/resident/news/requests/new"><Button size="sm" className="h-10 px-2 sm:px-3"><FilePlus2 className="h-4 w-4" /><span className="ml-1 hidden min-[390px]:inline">ขอเพิ่มข่าว</span></Button></Link></> : undefined} filters={<>
    <ResidentFilterDropdown label="แหล่งข่าว" options={([['all', 'ทั้งหมด'], ['admin', 'จากผู้ดูแล'], ['resident', 'จากลูกบ้าน']] as const).map(([value, label]) => ({ label, href: makeHref(value, selectedVisibilities, sort, keyword, hasResidentAccess), active: source === value }))} />
    {hasResidentAccess ? <ResidentMultiFilterDropdown label="การมองเห็น" clearHref={makeHref(source, [], sort, keyword, hasResidentAccess)} options={([['PUBLIC', 'สาธารณะ'], ['RESIDENT_ONLY', 'ภายในหมู่บ้าน']] as const).map(([value, label]) => ({ label, href: toggleVisibility(value), active: visibilitySet.has(value) }))} /> : null}
    <ResidentFilterDropdown label="เรียง" options={([['newest', 'ล่าสุดก่อน'], ['oldest', 'เก่าสุดก่อน']] as const).map(([value, label]) => ({ label, href: makeHref(source, selectedVisibilities, value, keyword, hasResidentAccess), active: sort === value }))} />
    {activeFilterCount > 0 ? <Link href={clearHref} className="inline-flex h-9 items-center rounded-md px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500">ล้างตัวกรอง</Link> : null}
  </>} />;
}
