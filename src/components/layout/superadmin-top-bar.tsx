"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LogoutButton } from "@/components/layout/logout-button";
import { superAdminMenuItems } from "@/components/layout/superadmin-sidebar";
import { cn } from "@/lib/utils";

type SuperAdminTopBarProps = {
  userName: string;
  unreadNotificationCount: number;
};

export function SuperAdminTopBar({ userName, unreadNotificationCount }: SuperAdminTopBarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const displayCount = unreadNotificationCount > 99 ? "99+" : `${unreadNotificationCount}`;
  const mobileItems = useMemo(() => superAdminMenuItems, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm md:px-6">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">Super Admin Control Center</p>
            <p className="text-xs text-slate-500">แจ้งเตือนที่ยังไม่อ่าน: {displayCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="เปิดเมนู"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="text-right">
            <p className="text-sm font-medium text-slate-900">{userName}</p>
            <p className="text-xs text-slate-500">SUPERADMIN</p>
          </div>
          <LogoutButton />
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="ปิดเมนู"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative h-full w-72 max-w-[85vw] overflow-y-auto border-r border-slate-800 bg-slate-950 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <p className="text-sm font-semibold text-white">เมนู Super Admin</p>
              <button
                type="button"
                className="rounded-md p-2 text-slate-300 hover:bg-slate-800"
                aria-label="ปิดเมนู"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="space-y-1 p-3">
              {mobileItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-cyan-500/20 text-cyan-200"
                        : "text-slate-200 hover:bg-slate-800"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
