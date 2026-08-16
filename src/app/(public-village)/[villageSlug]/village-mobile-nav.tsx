"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  ArrowLeft,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VillageSwitcher } from "./village-switcher";
import { isPublicVillageNavItemActive, PUBLIC_VILLAGE_NAV_ITEMS } from "./public-village-nav";

type VillageOption = {
  id: string;
  slug: string;
  name: string;
  moo: string | null;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
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
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, []);

  const navItems = PUBLIC_VILLAGE_NAV_ITEMS(base);

  return (
    <>
      <button
        type="button"
        className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white xl:hidden"
        onClick={() => setOpen(true)}
        aria-label="เปิดเมนู"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label="Village navigation">
          {/* Backdrop */}
          <button
            type="button"
            className="absolute inset-0 cursor-pointer bg-black/50"
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
                className="cursor-pointer rounded-md p-2 text-green-100 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-white"
                autoFocus
                aria-label="ปิดเมนู"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Nav items */}
            <nav className="flex-1 space-y-0.5 p-3">
              {navItems.map((item) => {
                const isActive = isPublicVillageNavItemActive(pathname, item.href, base);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "border-l-2 border-emerald-200 bg-white/20 pl-[0.625rem] font-semibold text-white"
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
                onClick={() => setOpen(false)}
                className="block rounded-lg bg-white/10 px-3 py-2 text-center text-sm text-white hover:bg-white/20"
              >
                <span className="inline-flex items-center justify-center gap-2"><ArrowLeft className="h-4 w-4" />กลับหน้าหลัก</span>
              </Link>
              <Link
                href="/auth/login"
                onClick={() => setOpen(false)}
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
