"use client";

import Link from "next/link";
import { Home, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TopNavigationLink, isTopNavigationItemActive } from "./top-navigation-link";

const marketingNavItems = [
  { href: "/info", label: "ข้อมูลโครงการ" },
  { href: "/faq", label: "คำถามพบบ่อย" },
  { href: "/feedback", label: "เสนอแนะ" },
] as const;

export function PublicNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          <Link href="/" className="flex min-w-0 items-center gap-2 font-bold text-green-700 text-lg">
            <Home className="h-5 w-5" />
            <span className="truncate text-base sm:text-lg">ระบบหมู่บ้านอัจฉริยะ</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm md:flex">
            {marketingNavItems.map((item) => (
              <TopNavigationLink
                key={item.href}
                href={item.href}
                active={isTopNavigationItemActive(pathname, item.href, "/")}
                activeIndicatorClassName="bg-green-600"
                className="font-medium text-gray-600 transition-colors hover:text-green-700"
              >
                {item.label}
              </TopNavigationLink>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/auth/login"
              className="px-4 py-2 text-sm text-green-700 border border-green-700 rounded-lg hover:bg-green-50"
            >
              เข้าสู่ระบบ
            </Link>
            <Link
              href="/auth/register"
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              สมัครสมาชิก
            </Link>
          </div>

          <div className="relative md:hidden">
            <button
              type="button"
              aria-expanded={mobileMenuOpen}
              aria-controls="public-mobile-menu"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              <Menu className="h-5 w-5" />
            </button>
            {mobileMenuOpen ? <div id="public-mobile-menu" className="absolute right-0 top-12 w-[min(92vw,22rem)] rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
              <nav className="space-y-1 text-sm text-gray-700">
                {marketingNavItems.map((item) => {
                  const active = isTopNavigationItemActive(pathname, item.href, "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={active ? "block rounded-lg border-l-2 border-green-600 bg-green-50 py-2 pl-2.5 pr-3 font-semibold text-green-700" : "block rounded-lg px-3 py-2 hover:bg-gray-100"}
                    >
                      {item.label}
                    </Link>
                  );
                })}
                <Link href="/consent" className="block rounded-lg px-3 py-2 hover:bg-gray-100">นโยบายความเป็นส่วนตัว</Link>
              </nav>
              <div className="my-3 h-px bg-gray-100" />
              <div className="grid gap-2">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center justify-center rounded-lg border border-green-700 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
                >
                  เข้าสู่ระบบ
                </Link>
                <Link
                  href="/auth/register"
                  className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  สมัครสมาชิก
                </Link>
              </div>
            </div> : null}
          </div>
        </div>
      </div>
    </header>
  );
}
