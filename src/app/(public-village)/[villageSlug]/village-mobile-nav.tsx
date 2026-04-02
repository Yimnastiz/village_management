"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  Download,
  Eye,
  Home,
  Image,
  MapPin,
  Menu,
  Newspaper,
  Phone,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VillageSwitcher } from "./village-switcher";

type VillageOption = {
  id: string;
  slug: string;
  name: string;
};

type Props = {
  base: string;
  villageName: string;
  villages: VillageOption[];
  currentSlug: string;
};

export function VillagePublicMobileNav({ base, villageName, villages, currentSlug }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const navItems = [
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
    <>
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 md:hidden"
        onClick={() => setOpen(true)}
        aria-label="เปิดเมนู"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="ปิดเมนู"
            onClick={() => setOpen(false)}
          />

          {/* Drawer */}
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-green-600 bg-green-700">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-green-600 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">หมู่บ้าน {villageName}</p>
                <p className="text-xs text-green-200">เมนูหลัก</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-green-100 hover:bg-green-600"
                aria-label="ปิดเมนู"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Nav items */}
            <nav className="flex-1 space-y-0.5 p-3">
              {navItems.map((item) => {
                const isActive =
                  item.href === base
                    ? pathname === base || pathname === base + "/"
                    : pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-white/20 text-white"
                        : "text-green-100 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Footer: village switcher + action links */}
            <div className="space-y-2 border-t border-green-600 p-4">
              <VillageSwitcher villages={villages} currentSlug={currentSlug} />
              <Link
                href="/"
                className="block rounded-lg bg-white/10 px-3 py-2 text-center text-sm text-white hover:bg-white/20"
              >
                หน้าค้นหาหมู่บ้าน
              </Link>
              <Link
                href="/auth/login"
                className="block rounded-lg bg-white/20 px-3 py-2 text-center text-sm font-medium text-white hover:bg-white/30"
              >
                เข้าสู่ระบบ
              </Link>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
