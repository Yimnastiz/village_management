"use client";

import Link from "next/link";
import { Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewsFilterChip, NewsToolbar } from "@/components/news/news-toolbar";

type Props = { keyword: string; stage: string; visibility: string; sort: string; suggestionTitles: string[] };

function href(keyword: string, stage: string, visibility: string, sort: string) {
  const params = new URLSearchParams();
  if (keyword.trim()) params.set("q", keyword.trim());
  if (stage !== "ALL") params.set("stage", stage);
  if (visibility !== "ALL") params.set("visibility", visibility);
  if (sort !== "newest") params.set("sort", sort);
  const query = params.toString(); return query ? `/admin/news?${query}` : "/admin/news";
}

export function AdminNewsToolbar({ keyword, stage, visibility, sort, suggestionTitles }: Props) {
  const count = Number(stage !== "ALL") + Number(visibility !== "ALL") + Number(sort !== "newest");
  return <NewsToolbar namespace="admin-news" title="จัดการข่าว" description="ค้นหาและกรองข่าวตามสถานะและการมองเห็น" searchAction="/admin/news" keyword={keyword} searchPlaceholder="ค้นหาชื่อหรือเนื้อหาข่าว" suggestionTitles={suggestionTitles} activeFilterCount={count} hiddenInputs={{ stage: stage === "ALL" ? "" : stage, visibility: visibility === "ALL" ? "" : visibility, sort: sort === "newest" ? "" : sort }} actions={<><Link href="/admin/news/requests" aria-label="คำขอข่าวจากลูกบ้าน"><Button size="sm" variant="outline" className="h-10 px-2 sm:px-3"><Inbox className="h-4 w-4" /><span className="hidden sm:ml-1.5 sm:inline">คำขอข่าว</span></Button></Link><Link href="/admin/news/new"><Button size="sm" className="h-10 px-2 sm:px-3"><Plus className="h-4 w-4" /><span className="ml-1 hidden min-[360px]:inline">เพิ่มข่าว</span></Button></Link></>} filters={<><span className="text-xs font-semibold text-gray-500">สถานะ</span>{[["ALL","ทั้งหมด"],["DRAFT","ร่าง"],["PUBLISHED","เผยแพร่"],["ARCHIVED","เก็บถาวร"]].map(([value,label]) => <NewsFilterChip key={value} href={href(keyword,value,visibility,sort)} active={stage===value}>{label}</NewsFilterChip>)}<span className="ml-1 text-xs font-semibold text-gray-500">การมองเห็น</span>{[["ALL","ทั้งหมด"],["PUBLIC","สาธารณะ"],["RESIDENT_ONLY","ลูกบ้าน"]].map(([value,label]) => <NewsFilterChip key={value} href={href(keyword,stage,value,sort)} active={visibility===value}>{label}</NewsFilterChip>)}<span className="ml-1 text-xs font-semibold text-gray-500">เรียง</span>{[["newest","ล่าสุด"],["oldest","เก่าสุด"]].map(([value,label]) => <NewsFilterChip key={value} href={href(keyword,stage,visibility,value)} active={sort===value}>{label}</NewsFilterChip>)}<NewsFilterChip href="/admin/news" active={false}>ล้างตัวกรอง</NewsFilterChip></>} />;
}
