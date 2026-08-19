"use client";

import Link from "next/link";
import { Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";

type Props = { keyword: string; stage: string; visibility: string; sort: string; suggestionTitles: string[]; pendingCount: number };

function href(keyword: string, stage: string, visibility: string, sort: string) {
  const params = new URLSearchParams();
  if (keyword.trim()) params.set("q", keyword.trim());
  if (stage !== "ALL") params.set("stage", stage);
  if (visibility !== "ALL") params.set("visibility", visibility);
  if (sort !== "newest") params.set("sort", sort);
  const query = params.toString();
  return query ? `/admin/news?${query}` : "/admin/news";
}

export function AdminNewsToolbar({ keyword, stage, visibility, sort, suggestionTitles, pendingCount }: Props) {
  return (
    <AdminListToolbar
      title="จัดการข่าว"
      description="ค้นหาและกรองข่าวตามสถานะและการมองเห็น"
      searchAction="/admin/news"
      clearHref="/admin/news"
      keyword={keyword}
      searchPlaceholder="ค้นหาชื่อหรือเนื้อหาข่าว"
      searchLabel="ค้นหาข่าว"
      suggestionTitles={suggestionTitles}
      groups={[
        { label: "สถานะ", options: [["ALL", "ทั้งหมด"], ["DRAFT", "ร่าง"], ["PUBLISHED", "เผยแพร่"], ["ARCHIVED", "จัดเก็บแล้ว"]].map(([value, label], index) => ({ label, href: href(keyword, value, visibility, sort), active: stage === value, isDefault: index === 0 })) },
        { label: "การมองเห็น", options: [["ALL", "ทั้งหมด"], ["PUBLIC", "สาธารณะ"], ["RESIDENT_ONLY", "ลูกบ้าน"]].map(([value, label], index) => ({ label, href: href(keyword, stage, value, sort), active: visibility === value, isDefault: index === 0 })) },
        { label: "เรียง", options: [["newest", "ล่าสุด"], ["oldest", "เก่าสุด"]].map(([value, label], index) => ({ label, href: href(keyword, stage, visibility, value), active: sort === value, isDefault: index === 0 })) },
      ]}
      actions={<>
        <Link href="/admin/news/requests" aria-label={pendingCount > 0 ? `คำขอข่าวจากลูกบ้าน ${pendingCount} รายการรอพิจารณา` : "คำขอข่าวจากลูกบ้าน"} className="relative"><Button size="sm" variant="outline" className="h-10 px-2 sm:px-3"><Inbox className="h-4 w-4" /><span className="hidden sm:ml-1.5 sm:inline">คำขอข่าว</span></Button>{pendingCount > 0 ? <span className="absolute right-0 top-0 inline-flex h-5 min-w-5 -translate-y-1/2 translate-x-1/4 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white">{pendingCount}</span> : null}</Link>
        <Link href="/admin/news/new"><Button size="sm" className="h-10 px-2 sm:px-3"><Plus className="h-4 w-4" /><span className="ml-1 hidden min-[360px]:inline">เพิ่มข่าว</span></Button></Link>
      </>}
    />
  );
}
