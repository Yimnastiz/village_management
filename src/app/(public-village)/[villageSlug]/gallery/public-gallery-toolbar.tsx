"use client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PublicPageToolbar } from "@/components/public/public-page-toolbar";
type SortValue = "newest" | "oldest";
interface Props { villageSlug: string; villageName: string; keyword: string; sort: SortValue; suggestionTitles: string[]; }
function href(villageSlug: string, keyword: string, sort: SortValue) { const p = new URLSearchParams(); if (keyword.trim()) p.set("q", keyword.trim()); if (sort !== "newest") p.set("sort", sort); return p.size ? `/${villageSlug}/gallery?${p}` : `/${villageSlug}/gallery`; }
export function PublicGalleryToolbar({ villageSlug, villageName, keyword, sort, suggestionTitles }: Props) { const chip = (on: boolean) => cn("rounded-lg px-3 py-1.5 text-xs font-medium", on ? "bg-green-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"); return <PublicPageToolbar namespace="public-gallery" title={`แกลเลอรี ${villageName}`} description="ค้นหาและเรียงเฉพาะอัลบั้มที่เผยแพร่สาธารณะ" keyword={keyword} placeholder="ค้นหาชื่อหรือรายละเอียดอัลบั้ม" suggestions={suggestionTitles} activeFilterCount={Number(sort !== "newest")} filters={<><span className="text-xs font-semibold text-gray-500">เรียง</span><Link href={href(villageSlug, keyword, "newest")} className={chip(sort === "newest")}>ล่าสุด</Link><Link href={href(villageSlug, keyword, "oldest")} className={chip(sort === "oldest")}>เก่าสุด</Link><Link href={`/${villageSlug}/gallery`} className={chip(false)}>ล้างตัวกรอง</Link></>} />; }
