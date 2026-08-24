"use client";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResidentFilterDropdown, ResidentPageToolbar } from "@/components/resident/resident-page-toolbar";
import { ResidentContactRequestModal } from "./resident-contact-request-modal";
import { CONTACT_SORT_OPTIONS, type ContactSort } from "@/lib/contact-sort";
type Props = { keyword: string; category: string; sort: ContactSort; categories: string[]; canSubmit: boolean };
function href(keyword: string, category = "", sort: ContactSort = "recommended") { const query = new URLSearchParams(); if (keyword.trim()) query.set("q", keyword.trim()); if (category) query.set("category", category); if (sort !== "recommended") query.set("sort", sort); return query.size ? `/resident/contacts?${query}` : "/resident/contacts"; }
export function ResidentContactsToolbar({ keyword, category, sort, categories, canSubmit }: Props) {
  const count = Number(Boolean(category));
  return <ResidentPageToolbar namespace="resident-contacts" title="ข้อมูลติดต่อ" registerHeader search={{ keyword, placeholder: "ค้นหาชื่อหรือเบอร์โทรศัพท์", label: "ค้นหาผู้ติดต่อ" }} activeFilterCount={count} actions={canSubmit ? <><Link href="/resident/contacts/requests" aria-label="ติดตามคำขอผู้ติดต่อ"><Button size="sm" variant="outline" className="h-10 px-2 sm:px-3"><ListChecks className="h-4 w-4" /><span className="hidden sm:ml-1.5 sm:inline">คำขอของฉัน</span></Button></Link><ResidentContactRequestModal /></> : undefined} filters={<>
    <ResidentFilterDropdown label="หมวดหมู่" options={[{ label: "ทั้งหมด", href: href(keyword, "", sort), active: !category }, ...categories.map((item) => ({ label: item, href: href(keyword, item, sort), active: category === item }))]} />
    <ResidentFilterDropdown label="เรียง" options={CONTACT_SORT_OPTIONS.map((option) => ({ label: option.label, href: href(keyword, category, option.value), active: sort === option.value }))} />
    {count > 0 ? <Link href={href(keyword, "", sort)} className="inline-flex h-9 items-center rounded-md px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500">ล้างตัวกรอง</Link> : null}
  </>} />;
}
