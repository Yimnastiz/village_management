"use client";

import Link from "next/link";
import { FilePlus2, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewsFilterChip } from "@/components/news/news-toolbar";
import { ResidentPageToolbar } from "@/components/resident/resident-page-toolbar";

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
  const toggle = (value: Visibility) => makeHref(source, visibilitySet.has(value) ? selectedVisibilities.filter((item) => item !== value) : [...selectedVisibilities, value], sort, keyword, hasResidentAccess);
  const count = Number(source !== "all") + Number(sort !== "newest") + (hasResidentAccess ? selectedVisibilities.length : 0);
  return <ResidentPageToolbar namespace="resident-news" title="ข่าว/ประกาศ" description="ข่าวสารและประกาศล่าสุดของหมู่บ้าน" search={{ keyword, placeholder: "ค้นหาชื่อข่าว", label: "ค้นหาข่าว", suggestions: suggestionTitles }} activeFilterCount={count} actions={canSubmit ? <><Link href="/resident/news/requests" aria-label="คำขอข่าวของฉัน"><Button size="sm" variant="outline" className="h-10 px-2 sm:px-3"><ListChecks className="h-4 w-4" /><span className="hidden sm:ml-1.5 sm:inline">คำขอของฉัน</span></Button></Link><Link href="/resident/news/requests/new"><Button size="sm" className="h-10 px-2 sm:px-3"><FilePlus2 className="h-4 w-4" /><span className="ml-1 hidden min-[390px]:inline">ขอเพิ่มข่าว</span></Button></Link></> : undefined} filters={<><span className="text-xs font-semibold text-gray-500">แหล่งข่าว</span>{([['all','ทั้งหมด'],['admin','จากผู้ดูแล'],['resident','จากลูกบ้าน']] as const).map(([value,label]) => <NewsFilterChip key={value} href={makeHref(value, selectedVisibilities, sort, keyword, hasResidentAccess)} active={source === value}>{label}</NewsFilterChip>)}{hasResidentAccess ? <><span className="ml-1 text-xs font-semibold text-gray-500">การมองเห็น</span>{([['PUBLIC','สาธารณะ'],['RESIDENT_ONLY','ภายในหมู่บ้าน']] as const).map(([value,label]) => <NewsFilterChip key={value} href={toggle(value)} active={visibilitySet.has(value)}>{label}</NewsFilterChip>)}</> : null}<span className="ml-1 text-xs font-semibold text-gray-500">เรียง</span>{([['newest','ล่าสุด'],['oldest','เก่าสุด']] as const).map(([value,label]) => <NewsFilterChip key={value} href={makeHref(source, selectedVisibilities, value, keyword, hasResidentAccess)} active={sort === value}>{label}</NewsFilterChip>)}<NewsFilterChip href="/resident/news" active={false}>ล้างตัวกรอง</NewsFilterChip></>} />;
}
