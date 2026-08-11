"use client";
import { Bell, ChevronDown, LockKeyhole, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./logout-button";
import {
  getResidentNavigationItems,
  LockedResidentMenuDialog,
  type ResidentNavigationState,
} from "./resident-sidebar";
import { adminMenuItems } from "./admin-sidebar";
import { cn } from "@/lib/utils";
import { useAutoHideTopBar } from "./use-auto-hide-top-bar";

interface TopBarProps {
  userArea: "resident" | "admin";
  userName: string;
  userImageUrl?: string | null;
  unreadNotificationCount: number;
  villageName?: string | null;
  adminRoleLabel?: string;
  residentNavigationState?: ResidentNavigationState;
}

export function TopBar({
  userArea,
  userName,
  userImageUrl,
  unreadNotificationCount,
  villageName,
  adminRoleLabel = "ผู้ใหญ่บ้าน",
  residentNavigationState,
}: TopBarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [lockedMenuLabel, setLockedMenuLabel] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationsHref = userArea === "admin" ? "/admin/notifications" : "/resident/notifications";
  const profileHref = userArea === "admin" ? "/admin/settings" : "/resident/profile";
  const mobileNavItems = useMemo(() => {
    if (userArea === "admin") {
      return adminMenuItems;
    }

    return getResidentNavigationItems(
      residentNavigationState ?? { hasMembership: true }
    ).sort((left, right) => left.mobilePriority - right.mobilePriority);
  }, [residentNavigationState, userArea]);
  const displayCount = unreadNotificationCount > 99 ? "99+" : `${unreadNotificationCount}`;
  const isAdminArea = userArea === "admin";
  const residentVillageLabel = villageName?.trim() ? `หมู่บ้าน ${villageName.trim()}` : "หมู่บ้าน";
  const adminVillageLabel = villageName?.trim() ? `ผู้ใหญ่บ้าน ${villageName.trim()}` : "ผู้ใหญ่บ้าน";
  const isResidentGuest = userArea === "resident" && !residentNavigationState?.hasMembership;
  const residentStatusLabel = isResidentGuest ? "ยังไม่ผูกเลขบ้าน" : "ลูกบ้าน";
  const topBarHidden = useAutoHideTopBar(mobileMenuOpen || Boolean(lockedMenuLabel) || focusWithin);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 4);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false);
    };

    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, []);

  return (
    <>
      <header
        onFocusCapture={() => setFocusWithin(true)}
        onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false); }}
        className={cn(
          "sticky top-0 z-40 h-[var(--app-topbar-visible-offset,4rem)] flex-shrink-0 overflow-visible border-b px-4 backdrop-blur transition-[height,transform,box-shadow,border-color] duration-[var(--app-topbar-motion,180ms)] md:h-16 md:px-6 md:translate-y-0",
          "flex items-center justify-between",
          topBarHidden ? "-translate-y-16 border-transparent" : "translate-y-0",
          isAdminArea
            ? "bg-gray-900/95 border-gray-700"
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
              ? "text-gray-200 hover:bg-gray-800"
              : "text-gray-600 hover:bg-gray-100"
          )}
          onClick={() => setMobileMenuOpen(true)}
          aria-label="เปิดเมนู"
        >
          <Menu className="h-5 w-5" />
        </button>
        {isAdminArea ? (
          <div className="flex items-center gap-2">
            <span className="max-w-[14rem] truncate rounded-full bg-blue-500 px-2.5 py-1 text-sm font-semibold text-white md:max-w-none">
              {adminVillageLabel}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-800">
              {residentVillageLabel}
            </p>
            {isResidentGuest && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                ยังไม่ผูกเลขบ้าน
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">
        <Link
          href={notificationsHref}
          className={cn(
            "relative p-2",
            isAdminArea
              ? "text-gray-200 hover:text-white"
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
        <div className="relative" ref={profileMenuRef}>
          <button
            type="button"
            aria-expanded={profileMenuOpen}
            aria-haspopup="menu"
            onClick={() => setProfileMenuOpen((open) => !open)}
            className={cn(
            "list-none flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 md:px-2",
            isAdminArea ? "hover:bg-gray-800" : "hover:bg-gray-100"
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
              isAdminArea ? "text-gray-100" : "text-gray-700"
            )}>{userName}</span>
            <ChevronDown className={cn(
              "hidden h-4 w-4 md:block",
              isAdminArea ? "text-gray-300" : "text-gray-400"
            )} />
          </button>
          {profileMenuOpen ? <div role="menu" className="absolute right-0 top-11 z-30 w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
            <div className="px-3 py-2">
              <p className="truncate text-sm font-semibold text-gray-900">{userName}</p>
              {userArea === "resident" ? (
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                  <span>{residentVillageLabel}</span>
                  <span className={cn("rounded-full px-2 py-0.5 font-medium", isResidentGuest ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700")}>
                    {residentStatusLabel}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-gray-500">{adminRoleLabel}</p>
              )}
            </div>
            <div className="my-1 h-px bg-gray-100" />
            <Link href={profileHref} role="menuitem" onClick={() => setProfileMenuOpen(false)} className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
              โปรไฟล์ผู้ใช้
            </Link>
            <Link href={notificationsHref} role="menuitem" onClick={() => setProfileMenuOpen(false)} className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
              การแจ้งเตือน
            </Link>
            <div className="my-1 h-px bg-gray-100" />
            <LogoutButton mode="menu" />
          </div> : null}
        </div>
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
                  {userArea === "resident" ? "เมนูลูกบ้าน" : "เมนูผู้ใหญ่บ้าน"}
                </p>
                {isAdminArea ? (
                  <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[11px] font-semibold text-white">{adminVillageLabel}</span>
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
                    onClick={(event) => {
                      if ("locked" in item && item.locked) {
                        event.preventDefault();
                        setMobileMenuOpen(false);
                        setLockedMenuLabel(item.label);
                      } else {
                        setMobileMenuOpen(false);
                      }
                    }}
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
                    <span className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    {"locked" in item && item.locked ? <LockKeyhole className="h-3.5 w-3.5 text-amber-500" aria-label="ต้องผูกเลขบ้านก่อน" /> : null}
                    {showUnread && (
                      <span className="inline-flex min-w-5 justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {displayCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
            <div className={cn("mt-auto border-t p-3", isAdminArea ? "border-slate-800" : "border-gray-200")}>
              <LogoutButton mode="menu" />
            </div>
          </aside>
        </div>
      )}
      {userArea === "resident" && residentNavigationState ? (
        <LockedResidentMenuDialog
          open={Boolean(lockedMenuLabel)}
          menuLabel={lockedMenuLabel}
          state={residentNavigationState}
          onClose={() => setLockedMenuLabel(null)}
        />
      ) : null}
    </>
  );
}
