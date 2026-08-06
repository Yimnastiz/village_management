"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Download, Eye, Home, Image, LogIn, MapPin, Newspaper, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { VillageSwitcher } from "./village-switcher";

type VillageOption = { id: string; slug: string; name: string };

type Props = {
  base: string;
  villageName: string;
  villages: VillageOption[];
  currentSlug: string;
};

export function GuestVillageTopbar({ base, villageName, villages, currentSlug }: Props) {
  const pathname = usePathname();
  const items = [
    { href: base, label: "หน้าแรก", icon: Home },
    { href: `${base}/news`, label: "ข่าวสาร", icon: Newspaper },
    { href: `${base}/calendar`, label: "ปฏิทิน", icon: Calendar },
    { href: `${base}/gallery`, label: "แกลเลอรี", icon: Image },
    { href: `${base}/places`, label: "สถานที่", icon: MapPin },
    { href: `${base}/transparency`, label: "ความโปร่งใส", icon: Eye },
    { href: `${base}/downloads`, label: "ดาวน์โหลด", icon: Download },
    { href: `${base}/contacts`, label: "ติดต่อ", icon: Phone },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-emerald-950/15 bg-emerald-800 text-white shadow-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:px-6 lg:px-8">
        <Link href={base} className="min-w-0 flex-1 truncate text-sm font-bold sm:text-base">
          หมู่บ้าน {villageName}
        </Link>
        <div className="min-w-0 shrink-0">
          <VillageSwitcher villages={villages} currentSlug={currentSlug} />
        </div>
        <Link href="/auth/login" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 text-xs font-medium hover:bg-white/20 sm:px-3 sm:text-sm">
          <LogIn className="h-4 w-4" />
          <span className="hidden sm:inline">เข้าสู่ระบบ</span>
        </Link>
      </div>

      <nav aria-label="เมนูข้อมูลสาธารณะ" className="bg-emerald-900/70">
        <div className="mx-auto max-w-7xl overflow-x-auto overscroll-x-contain px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-5 lg:px-7">
          <div className="flex h-10 min-w-max items-stretch gap-1">
            {items.map((item) => {
              const active = item.href === base
                ? pathname === base || pathname === `${base}/`
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn(
                  "relative inline-flex items-center gap-1.5 rounded-t-md px-2.5 text-xs font-medium whitespace-nowrap transition sm:px-3 sm:text-sm",
                  active ? "bg-white/15 text-white after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-emerald-300" : "text-emerald-100 hover:bg-white/10 hover:text-white"
                )}>
                  <item.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </header>
  );
}
