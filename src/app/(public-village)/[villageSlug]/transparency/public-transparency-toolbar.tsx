"use client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PublicPageToolbar } from "@/components/public/public-page-toolbar";
type SortValue = "date_desc" | "date_asc";
interface Props { villageSlug: string; villageName: string; keyword: string; sort: SortValue; suggestionTitles: string[]; }
function href(villageSlug: string, keyword: string, sort: SortValue) { const p = new URLSearchParams(); if (keyword.trim()) p.set("q", keyword.trim()); if (sort !== "date_desc") p.set("sort", sort); return p.size ? `/${villageSlug}/transparency?${p}` : `/${villageSlug}/transparency`; }
export function PublicTransparencyToolbar({ villageSlug, villageName, keyword, sort, suggestionTitles }: Props) { const chip = (on: boolean) => cn("rounded-lg px-3 py-1.5 text-xs font-medium", on ? "bg-green-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"); return <PublicPageToolbar namespace="public-transparency" title={`ความโปร่งใส ${villageName}`} description="ค้นหาเอกสารที่เผยแพร่สาธารณะเท่านั้น" keyword={keyword} placeholder="ค้นหาชื่อเอกสารหรือข้อมูลสาธารณะ" suggestions={suggestionTitles} activeFilterCount={Number(sort !== "date_desc")} filters={<><span className="text-xs font-semibold text-gray-500">เรียง</span><Link href={href(villageSlug, keyword, "date_desc")} className={chip(sort === "date_desc")}>ล่าสุด</Link><Link href={href(villageSlug, keyword, "date_asc")} className={chip(sort === "date_asc")}>เก่าสุด</Link><Link href={`/${villageSlug}/transparency`} className={chip(false)}>ล้างตัวกรอง</Link></>} />; }
