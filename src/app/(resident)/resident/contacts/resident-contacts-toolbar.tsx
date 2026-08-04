"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";

function buildContactsHref(keyword: string, category = "", sort = "default") {
  const query = new URLSearchParams();
  const trimmedKeyword = keyword.trim();

  if (trimmedKeyword) {
    query.set("q", trimmedKeyword);
  }
  if (category) query.set("category", category);
  if (sort !== "default") query.set("sort", sort);

  const queryString = query.toString();
  return queryString ? `/resident/contacts?${queryString}` : "/resident/contacts";
}

interface ResidentContactsToolbarProps {
  keyword: string;
  category: string;
  sort: string;
  categories: string[];
  canSubmit: boolean;
}

export function ResidentContactsToolbar({ keyword, category, sort, categories, canSubmit }: ResidentContactsToolbarProps) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(Boolean(keyword));
  const [searchKeyword, setSearchKeyword] = useState(keyword);

  useEffect(() => {
    setSearchKeyword(keyword);
  }, [keyword]);

  useEffect(() => {
    if (!searchOpen) return;

    const timeoutId = setTimeout(() => {
      router.push(buildContactsHref(searchKeyword, category, sort));
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [searchKeyword, searchOpen, category, sort, router]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="รายชื่อผู้ติดต่อ"
        description="ช่องทางติดต่อหน่วยงานและผู้ประสานงานในหมู่บ้าน"
        actions={canSubmit ? <>
          <Link
            href="/resident/contacts/new"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-green-600 px-3 text-sm font-medium text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            ส่งคำขอเพิ่มผู้ติดต่อ
          </Link>
          <Link
            href="/resident/contacts/requests"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            ติดตามคำขอของฉัน
          </Link>
        </> : undefined}
      />

      <FilterBar activeFilterCount={Number(Boolean(category)) + Number(sort !== "default")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
            aria-label="ค้นหาผู้ติดต่อ"
            onClick={() => setSearchOpen((currentValue) => !currentValue)}
          >
            <Search className="h-4 w-4" />
          </button>

          {searchOpen && (
            <input
              autoFocus
              placeholder="ค้นหาชื่อหรือเบอร์โทรศัพท์"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-sm outline-none ring-green-600 placeholder:text-gray-400 focus:ring-1 sm:max-w-md"
            />
          )}

          {searchOpen && (
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100"
              aria-label="ปิดค้นหา"
              onClick={() => setSearchOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          )}
          </div>
          <Link
            href="/resident/contacts"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ล้างตัวกรอง
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
          {categories.length > 0 ? <><span className="text-xs font-medium text-gray-500">ประเภท</span><Link href={buildContactsHref(keyword, "", sort)} className={`rounded-full px-3 py-1 text-xs font-medium ${!category ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>ทั้งหมด</Link>{categories.map((item) => <Link key={item} href={buildContactsHref(keyword, item, sort)} className={`rounded-full px-3 py-1 text-xs font-medium ${category === item ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{item}</Link>)}</> : null}
          <label className="ml-auto flex items-center gap-2 text-xs font-medium text-gray-500">เรียงลำดับ<select value={sort} onChange={(event) => router.push(buildContactsHref(keyword, category, event.target.value))} className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-700"><option value="default">ลำดับที่กำหนด</option><option value="name">ชื่อ ก-ฮ</option></select></label>
        </div>
      </FilterBar>
    </div>
  );
}
