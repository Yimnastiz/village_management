"use client";
import { Bell, ChevronDown, Menu } from "lucide-react";
import Link from "next/link";
import { LogoutButton } from "./logout-button";
import { residentMenuItems } from "./resident-sidebar";

interface TopBarProps {
  userArea: "resident" | "admin";
  userName: string;
  userImageUrl?: string | null;
  unreadNotificationCount: number;
}

export function TopBar({ userArea, userName, userImageUrl, unreadNotificationCount }: TopBarProps) {
  const notificationsHref = userArea === "admin" ? "/admin/notifications" : "/resident/notifications";
  const profileHref = userArea === "admin" ? "/admin/settings" : "/resident/profile";
  const mobileNavItems = [...residentMenuItems].sort(
    (left, right) => left.mobilePriority - right.mobilePriority
  );
  const displayCount = unreadNotificationCount > 99 ? "99+" : `${unreadNotificationCount}`;

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 md:px-6 flex-shrink-0">
      <div className="flex items-center gap-2">
        {userArea === "resident" && (
          <details className="relative md:hidden">
            <summary className="list-none inline-flex cursor-pointer items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100">
              <Menu className="h-5 w-5" />
            </summary>
            <div className="absolute left-0 top-11 z-30 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
              <p className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                เมนูลูกบ้าน
              </p>
              <div className="space-y-1">
                {mobileNavItems.map((item) => {
                  const showUnread = item.href === "/resident/notifications" && unreadNotificationCount > 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
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
              </div>
            </div>
          </details>
        )}
        <p className="hidden text-sm font-semibold text-gray-800 md:block">
          {userArea === "resident" ? "พื้นที่ลูกบ้าน" : "พื้นที่ผู้ดูแล"}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <Link href={notificationsHref} className="relative p-2 text-gray-400 hover:text-gray-600">
          <Bell className="h-5 w-5" />
          {unreadNotificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-5 justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
              {displayCount}
            </span>
          )}
        </Link>
        <details className="relative">
          <summary className="list-none flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 hover:bg-gray-100 md:px-2">
            <div className="h-8 w-8 overflow-hidden rounded-full bg-green-100 flex items-center justify-center">
              {userImageUrl ? (
                <img src={userImageUrl} alt={userName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-medium text-green-700">{userName.trim().charAt(0) || "ผ"}</span>
              )}
            </div>
            <span className="hidden max-w-32 truncate text-sm font-medium text-gray-700 md:block">{userName}</span>
            <ChevronDown className="hidden h-4 w-4 text-gray-400 md:block" />
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
  );
}
