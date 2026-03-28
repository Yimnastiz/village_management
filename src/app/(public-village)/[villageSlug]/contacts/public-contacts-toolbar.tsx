"use client";

import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";

interface PublicContactsToolbarProps {
  villageSlug: string;
  villageName: string;
  keyword: string;
}

function buildPublicContactsHref(villageSlug: string, keyword: string) {
  const query = new URLSearchParams();
  const trimmedKeyword = keyword.trim();

  if (trimmedKeyword) {
    query.set("q", trimmedKeyword);
  }

  const queryString = query.toString();
  const basePath = `/${villageSlug}/contacts`;
  return queryString ? `${basePath}?${queryString}` : basePath;
}

export function PublicContactsToolbar({ villageSlug, villageName, keyword }: PublicContactsToolbarProps) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(Boolean(keyword));
  const [searchKeyword, setSearchKeyword] = useState(keyword);

  useEffect(() => {
    setSearchKeyword(keyword);
  }, [keyword]);

  useEffect(() => {
    if (!searchOpen) return;

    const timeoutId = setTimeout(() => {
      router.push(buildPublicContactsHref(villageSlug, searchKeyword));
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [searchKeyword, searchOpen, villageSlug, router]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">รายชื่อผู้ติดต่อ</h1>
          <p className="text-sm text-gray-500 mt-1">ช่องทางติดต่อหน่วยงานและผู้ประสานงานของ {villageName}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
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
            className="h-9 w-64 rounded-lg border border-gray-300 px-3 text-sm outline-none ring-green-600 placeholder:text-gray-400 focus:ring-1"
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
    </div>
  );
}
