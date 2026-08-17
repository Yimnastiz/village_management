"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ShieldCheck, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin/settings/profile", label: "ข้อมูลส่วนตัว", icon: UserRound },
  { href: "/admin/settings/village", label: "ข้อมูลหมู่บ้าน", icon: Building2 },
  { href: "/admin/settings/access", label: "สิทธิ์ผู้ใช้", icon: ShieldCheck },
];

export function SettingsNavigation() {
  const pathname = usePathname();
  return <nav aria-label="เมนูการตั้งค่า" className="min-w-0 lg:w-56 lg:shrink-0">
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1 shadow-sm [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:p-2">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 lg:w-full", active && "bg-gray-100 font-medium text-gray-950") }>
          <Icon className={cn("h-4 w-4", active ? "text-green-700" : "text-gray-400")} aria-hidden="true" />{label}
        </Link>;
      })}
    </div>
  </nav>;
}
