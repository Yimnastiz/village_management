"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  Shield,
  Megaphone,
  ScrollText,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SuperAdminMenuItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export const superAdminMenuItems: SuperAdminMenuItem[] = [
  { href: "/superadmin/dashboard", label: "ภาพรวมระบบ", icon: LayoutDashboard },
  { href: "/superadmin/villages", label: "จัดการหมู่บ้าน", icon: Building2 },
  { href: "/superadmin/users", label: "จัดการผู้ใช้", icon: Users },
  { href: "/superadmin/roles", label: "บทบาทและสิทธิ์", icon: Shield },
  { href: "/superadmin/broadcasts", label: "ประกาศทุกหมู่บ้าน", icon: Megaphone },
  { href: "/superadmin/logs", label: "บันทึกกิจกรรมระบบ", icon: ScrollText },
  { href: "/superadmin/settings", label: "ตั้งค่ากลางระบบ", icon: Settings },
];

export function SuperAdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-72 overflow-y-auto border-r border-slate-800 bg-slate-950 text-slate-200 md:flex md:flex-col">
      <div className="border-b border-slate-800 p-4">
        <Link href="/superadmin/dashboard" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500">
            <Shield className="h-5 w-5 text-slate-950" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Super Admin</p>
            <p className="text-xs text-slate-400">Village Management System</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {superAdminMenuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-cyan-500/20 text-cyan-200"
                  : "text-slate-300 hover:bg-slate-900 hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
