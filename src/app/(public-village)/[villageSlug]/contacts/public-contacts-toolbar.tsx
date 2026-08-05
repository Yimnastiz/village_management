"use client";
import Link from "next/link";
import { PublicPageToolbar } from "@/components/public/public-page-toolbar";
interface Props { villageSlug: string; villageName: string; keyword: string; }
export function PublicContactsToolbar({ villageSlug, villageName, keyword }: Props) { return <PublicPageToolbar namespace="public-contacts" title={`ผู้ติดต่อ ${villageName}`} description="ค้นหาเฉพาะช่องทางติดต่อที่เผยแพร่สาธารณะ" keyword={keyword} placeholder="ค้นหาชื่อ หน่วยงาน ตำแหน่ง หรือเบอร์สาธารณะ" filters={<Link href={`/${villageSlug}/contacts`} className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200">ล้างตัวกรอง</Link>} />; }
