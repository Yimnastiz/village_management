"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Download, Eye, Globe2, Home, Image, LogIn, MapPin, Newspaper, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { VillageSwitcher } from "./village-switcher";
import { VillagePublicMobileNav } from "./village-mobile-nav";

type VillageOption = { id: string; slug: string; name: string; moo: string | null; province: string | null; district: string | null; subdistrict: string | null };
type Props = { base: string; villageName: string; villages: VillageOption[]; currentSlug: string };

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
  const isActive = (href: string) => href === base
    ? pathname === base || pathname === `${base}/`
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-emerald-950/15 bg-emerald-800 text-white shadow-sm [&>nav]:hidden">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-2 px-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:px-6 xl:h-16 xl:px-8">
        <Link href={base} className="min-w-0 flex-1 truncate text-sm font-bold sm:text-base xl:max-w-40 xl:flex-none">
          หมู่บ้าน {villageName}
        </Link>

        <nav aria-label="เมนูข้อมูลสาธารณะ" className="hidden min-w-0 flex-1 items-stretch self-stretch xl:flex">
          {items.slice(1).map((item) => {
            const active = isActive(item.href);
            return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn(
              "relative inline-flex min-w-0 flex-1 items-center justify-center px-2 text-sm font-medium whitespace-nowrap transition",
              active ? "bg-white/12 text-white after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-emerald-300" : "text-emerald-100 hover:bg-white/10 hover:text-white"
            )}>{item.label}</Link>;
          })}
        </nav>

        <VillagePublicMobileNav base={base} villageName={villageName} villages={villages} currentSlug={currentSlug} />
        <div className="min-w-0 shrink-0"><VillageSwitcher villages={villages} currentSlug={currentSlug} /></div>
        <Link href="/" aria-label="กลับไปยังหน้าเว็บไซต์สาธารณะ" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 text-xs font-medium hover:bg-white/20 xl:px-3">
          <Globe2 className="h-4 w-4" /><span className="hidden 2xl:inline">เว็บไซต์สาธารณะ</span>
        </Link>
        <Link href="/auth/login" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 text-xs font-medium hover:bg-white/20 xl:px-3">
          <LogIn className="h-4 w-4" /><span className="hidden sm:inline">เข้าสู่ระบบ</span>
        </Link>
      </div>

      <nav aria-label="เมนูข้อมูลสาธารณะบนมือถือ" className="bg-emerald-900/70 xl:hidden">
        <div className="mx-auto max-w-7xl overflow-x-auto overscroll-x-contain px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-5">
          <div className="flex h-10 min-w-max items-stretch gap-1">
            {items.map((item) => {
              const active = isActive(item.href);
              return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn(
                "relative inline-flex items-center gap-1.5 rounded-t-md px-2.5 text-xs font-medium whitespace-nowrap transition sm:px-3 sm:text-sm",
                active ? "bg-white/15 text-white after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-emerald-300" : "text-emerald-100 hover:bg-white/10 hover:text-white"
              )}><item.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />{item.label}</Link>;
            })}
          </div>
        </div>
      </nav>
    </header>
  );
}
