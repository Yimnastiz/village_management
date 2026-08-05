"use client";

import Link from "next/link";
import { FilePlus2, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewsFilterChip, NewsToolbar } from "@/components/news/news-toolbar";

type NewsVisibilityValue = "PUBLIC" | "RESIDENT_ONLY";
type NewsSort = "newest" | "oldest";
type SourceValue = "all" | "resident" | "admin";
type Props = { keyword: string; source: SourceValue; selectedVisibilities: NewsVisibilityValue[]; sort: NewsSort; suggestionTitles: string[]; canSubmit: boolean };

function href(source: SourceValue, visibilities: NewsVisibilityValue[], sort: NewsSort, keyword: string) {
  const params = new URLSearchParams();
  if (source !== "all") params.set("source", source);
  if (visibilities.length) params.set("visibility", Array.from(new Set(visibilities)).sort().join(","));
  if (sort !== "newest") params.set("sort", sort);
  if (keyword.trim()) params.set("q", keyword.trim());
  const query = params.toString(); return query ? `/resident/news?${query}` : "/resident/news";
}

export function ResidentNewsToolbar({ keyword, source, selectedVisibilities, sort, suggestionTitles, canSubmit }: Props) {
  const visibilitySet = new Set(selectedVisibilities);
  const toggle = (value: NewsVisibilityValue) => {
    const next = new Set(visibilitySet); if (next.has(value)) next.delete(value); else next.add(value);
    return href(source, Array.from(next), sort, keyword);
  };
  const count = Number(source !== "all") + selectedVisibilities.length + Number(sort !== "newest");
  return <NewsToolbar namespace="resident-news" title="ข่าว/ประกาศ" description="ข่าวสารและประกาศล่าสุดของหมู่บ้าน" searchAction="/resident/news" keyword={keyword} searchPlaceholder="ค้นหาชื่อข่าว" suggestionTitles={suggestionTitles} activeFilterCount={count} hiddenInputs={{ source: source === "all" ? "" : source, visibility: selectedVisibilities.join(","), sort: sort === "newest" ? "" : sort }} actions={canSubmit ? <><Link href="/resident/news/requests" aria-label="คำขอข่าวของฉัน"><Button size="sm" variant="outline" className="h-10 px-2 sm:px-3"><ListChecks className="h-4 w-4" /><span className="hidden sm:ml-1.5 sm:inline">คำขอของฉัน</span></Button></Link><Link href="/resident/news/requests/new"><Button size="sm" className="h-10 px-2 sm:px-3"><FilePlus2 className="h-4 w-4" /><span className="ml-1 hidden min-[390px]:inline">ขอเพิ่มข่าว</span></Button></Link></> : undefined} filters={<><span className="text-xs font-semibold text-gray-500">แหล่งข่าว</span>{([['all','ทั้งหมด'],['admin','จากผู้ดูแล'],['resident','จากลูกบ้าน']] as const).map(([value,label]) => <NewsFilterChip key={value} href={href(value,selectedVisibilities,sort,keyword)} active={source===value}>{label}</NewsFilterChip>)}<span className="ml-1 text-xs font-semibold text-gray-500">การมองเห็น</span>{([['PUBLIC','สาธารณะ'],['RESIDENT_ONLY','ภายในหมู่บ้าน']] as const).map(([value,label]) => <NewsFilterChip key={value} href={toggle(value)} active={visibilitySet.has(value)}>{label}</NewsFilterChip>)}<span className="ml-1 text-xs font-semibold text-gray-500">เรียง</span>{([['newest','ล่าสุด'],['oldest','เก่าสุด']] as const).map(([value,label]) => <NewsFilterChip key={value} href={href(source,selectedVisibilities,value,keyword)} active={sort===value}>{label}</NewsFilterChip>)}<NewsFilterChip href="/resident/news" active={false}>ล้างตัวกรอง</NewsFilterChip></>} />;
}
