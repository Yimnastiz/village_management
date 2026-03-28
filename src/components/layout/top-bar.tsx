"use client";
import { Bell, ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./logout-button";
import { residentMenuItems } from "./resident-sidebar";
import { adminMenuItems } from "./admin-sidebar";
import { cn } from "@/lib/utils";

interface TopBarProps {
  userArea: "resident" | "admin";
  userName: string;
  userImageUrl?: string | null;
  unreadNotificationCount: number;
  villageName?: string | null;
}

export function TopBar({ userArea, userName, userImageUrl, unreadNotificationCount, villageName }: TopBarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const notificationsHref = userArea === "admin" ? "/admin/notifications" : "/resident/notifications";
  const profileHref = userArea === "admin" ? "/admin/settings" : "/resident/profile";
  const mobileNavItems = useMemo(() => {
    if (userArea === "admin") {
      return adminMenuItems;
    }

    return [...residentMenuItems].sort((left, right) => left.mobilePriority - right.mobilePriority);
  }, [userArea]);
  const displayCount = unreadNotificationCount > 99 ? "99+" : `${unreadNotificationCount}`;
  const isAdminArea = userArea === "admin";
  const adminVillageLabel = `แอดมิน${villageName?.trim() ? villageName.trim() : "หมู่บ้าน"}`;

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 4);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 backdrop-blur border-b h-16 flex items-center justify-between px-4 md:px-6 flex-shrink-0 transition-shadow",
          isAdminArea
            ? "bg-blue-700/95 border-blue-800"
            : "bg-white/95 border-gray-200",
          isScrolled ? "shadow-sm" : "shadow-none"
        )}
      >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={cn(
            "inline-flex cursor-pointer items-center justify-center rounded-md p-2 md:hidden",
            isAdminArea
              ? "text-blue-100 hover:bg-blue-800"
              : "text-gray-600 hover:bg-gray-100"
          )}
          onClick={() => setMobileMenuOpen(true)}
          aria-label="เปิดเมนู"
        >
          <Menu className="h-5 w-5" />
        </button>
        {isAdminArea ? (
          <div className="flex items-center gap-2">
            <span className="max-w-36 truncate rounded-full bg-green-500 px-2.5 py-1 text-xs font-semibold text-white md:max-w-none">
              {adminVillageLabel}
            </span>
          </div>
        ) : (
          <p className="hidden text-sm font-semibold text-gray-800 md:block">
            {villageName?.trim() || "-"}
          </p>
        )}
      </div>
      <div className="flex items-center gap-4">
        <Link
          href={notificationsHref}
          className={cn(
            "relative p-2",
            isAdminArea
              ? "text-blue-100 hover:text-white"
              : "text-gray-400 hover:text-gray-600"
          )}
        >
          <Bell className="h-5 w-5" />
          {unreadNotificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-5 justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
              {displayCount}
            </span>
          )}
        </Link>
        <details className="relative">
          <summary className={cn(
            "list-none flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 md:px-2",
            isAdminArea ? "hover:bg-blue-800" : "hover:bg-gray-100"
          )}>
            <div className={cn(
              "h-8 w-8 overflow-hidden rounded-full flex items-center justify-center",
              isAdminArea ? "bg-blue-100" : "bg-green-100"
            )}>
              {userImageUrl ? (
                <img src={userImageUrl} alt={userName} className="h-full w-full object-cover" />
              ) : (
                <span className={cn(
                  "text-xs font-medium",
                  isAdminArea ? "text-blue-700" : "text-green-700"
                )}>{userName.trim().charAt(0) || "ผ"}</span>
              )}
            </div>
            <span className={cn(
              "hidden max-w-32 truncate text-sm font-medium md:block",
              isAdminArea ? "text-blue-50" : "text-gray-700"
            )}>{userName}</span>
            <ChevronDown className={cn(
              "hidden h-4 w-4 md:block",
              isAdminArea ? "text-blue-200" : "text-gray-400"
            )} />
          </summary>
          <div className="absolute right-0 top-11 z-30 w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
            <div className="px-3 py-2">
              <p className="truncate text-sm font-semibold text-gray-900">{userName}</p>
              <p className="text-xs text-gray-500">{userArea === "resident" ? "ลูกบ้าน" : "ผู้ดูแลระบบ"}</p>
            </div>
            <div className="my-1 h-px bg-gray-100" />
            <Link href={profileHref} className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
              โปรไฟล์ผู้ใช้
            </Link>
            <Link href={notificationsHref} className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
              การแจ้งเตือน
            </Link>
            <div className="my-1 h-px bg-gray-100" />
            <LogoutButton mode="menu" />
          </div>
        </details>
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
          <aside className={cn(
            "relative h-full w-72 max-w-[85vw] overflow-y-auto border-r shadow-xl",
            isAdminArea
              ? "border-slate-800 bg-slate-900"
              : "border-gray-200 bg-white"
          )}>
            <div className={cn(
              "flex items-center justify-between border-b px-4 py-3",
              isAdminArea ? "border-slate-800" : "border-gray-200"
            )}>
              <div className="flex items-center gap-2">
                <p className={cn(
                  "text-sm font-semibold",
                  isAdminArea ? "text-white" : "text-gray-900"
                )}>
                  {userArea === "resident" ? "เมนูลูกบ้าน" : "เมนูผู้ดูแล"}
                </p>
                {isAdminArea ? (
                  <span className="rounded-full bg-green-500 px-2 py-0.5 text-[11px] font-semibold text-white">{adminVillageLabel}</span>
                ) : null}
              </div>
              <button
                type="button"
                className={cn(
                  "rounded-md p-2",
                  isAdminArea
                    ? "text-slate-300 hover:bg-slate-800"
                    : "text-gray-500 hover:bg-gray-100"
                )}
                aria-label="ปิดเมนู"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1 p-3">
              {mobileNavItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const showUnread = item.href === notificationsHref && unreadNotificationCount > 0;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? isAdminArea
                          ? "bg-blue-500/20 text-blue-200"
                          : "bg-green-50 text-green-700"
                        : isAdminArea
                          ? "text-slate-200 hover:bg-slate-800"
                          : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <span>{item.label}</span>
                    {showUnread && (
                      <span className="inline-flex min-w-5 justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {displayCount}
                      </span>
                    )}
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
