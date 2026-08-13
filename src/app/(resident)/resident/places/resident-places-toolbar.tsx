"use client";

import Link from "next/link";
import { FilePlus2, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewsFilterChip } from "@/components/news/news-toolbar";
import { ResidentPageToolbar } from "@/components/resident/resident-page-toolbar";
import { VILLAGE_PLACE_CATEGORY_LABELS } from "@/lib/constants";

type SortValue = "newest" | "oldest" | "name_asc" | "name_desc";
type Props = { keyword: string; category: string; sort: SortValue; suggestionTitles: string[]; canSubmit: boolean };
const sortOptions: Array<{ value: SortValue; label: string }> = [{ value: "newest", label: "ล่าสุดก่อน" }, { value: "oldest", label: "เก่าก่อน" }, { value: "name_asc", label: "ชื่อ ก-ฮ" }, { value: "name_desc", label: "ชื่อ ฮ-ก" }];

function href({ keyword, category, sort }: { keyword: string; category: string; sort: SortValue }) {
  const query = new URLSearchParams();
  if (keyword.trim()) query.set("q", keyword.trim());
  if (category !== "ALL") query.set("category", category);
  if (sort !== "newest") query.set("sort", sort);
  return query.size ? `/resident/places?${query}` : "/resident/places";
}

export function ResidentPlacesToolbar({ keyword, category, sort, suggestionTitles, canSubmit }: Props) {
  const activeFilterCount = Number(category !== "ALL") + Number(sort !== "newest");
  return <ResidentPageToolbar namespace="resident-places" title="สถานที่ในหมู่บ้าน" description="ค้นหาวัด ร้านค้า โรงเรียน และสถานที่จำเป็นใกล้บ้าน" search={{ keyword, placeholder: "พิมพ์ชื่อสถานที่", label: "ค้นหาสถานที่", suggestions: suggestionTitles }} activeFilterCount={activeFilterCount} actions={canSubmit ? <><Link href="/resident/places/requests" aria-label="คำขอสถานที่ของฉัน"><Button size="sm" variant="outline" className="h-10 px-2 sm:px-3"><ListChecks className="h-4 w-4" /><span className="hidden sm:ml-1.5 sm:inline">คำขอของฉัน</span></Button></Link><Link href="/resident/places/requests/new"><Button size="sm" className="h-10 px-2 sm:px-3"><FilePlus2 className="h-4 w-4" /><span className="hidden min-[390px]:ml-1 min-[390px]:inline">ขอเพิ่มสถานที่</span></Button></Link></> : undefined} filters={<><span className="text-xs font-semibold text-gray-500">หมวดหมู่</span><NewsFilterChip href={href({ keyword, category: "ALL", sort })} active={category === "ALL"}>ทั้งหมด</NewsFilterChip>{Object.entries(VILLAGE_PLACE_CATEGORY_LABELS).map(([value, label]) => <NewsFilterChip key={value} href={href({ keyword, category: value, sort })} active={category === value}>{label}</NewsFilterChip>)}<span className="ml-1 text-xs font-semibold text-gray-500">เรียง</span>{sortOptions.map((option) => <NewsFilterChip key={option.value} href={href({ keyword, category, sort: option.value })} active={sort === option.value}>{option.label}</NewsFilterChip>)}<NewsFilterChip href="/resident/places" active={false}>ล้างตัวกรอง</NewsFilterChip></>} />;
}
