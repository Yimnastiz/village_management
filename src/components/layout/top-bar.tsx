"use client";
import { Bell, ChevronDown } from "lucide-react";
import Link from "next/link";
import { LogoutButton } from "./logout-button";

interface TopBarProps {
  userArea: "resident" | "admin";
  userName?: string;
}

export function TopBar({ userArea, userName = "ผู้ใช้งาน" }: TopBarProps) {
  const notificationsHref = userArea === "admin" ? "/admin/notifications" : "/resident/notifications";
  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 flex-shrink-0">
      <div />
      <div className="flex items-center gap-4">
        <Link href={notificationsHref} className="relative p-2 text-gray-400 hover:text-gray-600">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </Link>
        <div className="flex items-center gap-2 cursor-pointer">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-xs font-medium text-green-700">
              {userName.charAt(0)}
            </span>
          </div>
          <span className="text-sm font-medium text-gray-700">{userName}</span>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
