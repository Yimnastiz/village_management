"use client";

/* eslint-disable react-hooks/set-state-in-effect -- workspace navigation restores the persisted sidebar preference. */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Building2,
  Users,
  Shield,
  Megaphone,
  MessageSquare,
  ScrollText,
  Settings,
  ListChecks,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarTooltip } from "@/components/ui/sidebar-tooltip";
import { SuperAdminLogoutButton } from "@/components/layout/superadmin-logout-button";

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
  { href: "/superadmin/data-quality", label: "Data Quality", icon: ListChecks },
  { href: "/superadmin/broadcasts", label: "ประกาศทุกหมู่บ้าน", icon: Megaphone },
  { href: "/superadmin/feedback", label: "Feedback ผู้ใช้งาน", icon: MessageSquare },
  { href: "/superadmin/logs", label: "บันทึกกิจกรรมระบบ", icon: ScrollText },
  { href: "/superadmin/settings", label: "ตั้งค่ากลางระบบ", icon: Settings },
];

export function SuperAdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const previousWorkspace = useRef<boolean | null>(null);
  const isWorkspace = /^\/superadmin\/villages\/[^/]+(?:\/|$)/.test(pathname);

  useLayoutEffect(() => {
    const overrideKey = "village-superadmin-workspace-sidebar-override";
    const storedCollapsed = localStorage.getItem("village-superadmin-sidebar-collapsed") === "true";

    if (previousWorkspace.current === null) {
      if (!isWorkspace) {
        sessionStorage.removeItem(overrideKey);
        setCollapsed(storedCollapsed);
      } else if (sessionStorage.getItem(overrideKey) === "true") {
        setCollapsed(storedCollapsed);
      } else {
        setCollapsed(true);
        localStorage.setItem("village-superadmin-sidebar-collapsed", "true");
      }
    } else if (!previousWorkspace.current && isWorkspace) {
      setCollapsed(true);
      localStorage.setItem("village-superadmin-sidebar-collapsed", "true");
    } else if (previousWorkspace.current && !isWorkspace) {
      sessionStorage.removeItem(overrideKey);
    }

    previousWorkspace.current = isWorkspace;
  }, [isWorkspace]);

  const toggle = () => setCollapsed((value) => {
    const nextValue = !value;
    localStorage.setItem("village-superadmin-sidebar-collapsed", String(nextValue));
    if (isWorkspace) sessionStorage.setItem("village-superadmin-workspace-sidebar-override", "true");
    return nextValue;
  });

  return (
    <aside className={cn("sticky top-0 hidden h-screen overflow-hidden border-r border-slate-800 bg-slate-950 text-slate-200 transition-[width] duration-200 md:flex md:flex-col", collapsed ? "w-[72px]" : "w-60")}>
      <div className={cn("border-b border-slate-800", collapsed ? "p-3" : "p-4")}>
        <div className={cn("flex items-center gap-2", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed ? <Link href="/superadmin/dashboard" className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500">
            <Shield className="h-5 w-5 text-slate-950" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Super Admin</p>
            <p className="text-xs text-slate-400">Village Management System</p>
          </div>
        </Link> : null}
          <button type="button" onClick={toggle} aria-label={collapsed ? "ขยายเมนู" : "ย่อเมนู"} aria-expanded={!collapsed} title={collapsed ? "ขยายเมนู" : "ย่อเมนู"} className="rounded p-1 text-slate-400 hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>
        </div>
      </div>

      <nav className="sidebar-scroll flex-1 space-y-1 overflow-y-auto p-3">
        {superAdminMenuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <SidebarTooltip key={item.href} label={item.label} disabled={!collapsed}><Link
              href={item.href}
              aria-label={item.label}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-cyan-500/20 text-cyan-200"
                  : "text-slate-300 hover:bg-slate-900 hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className={collapsed ? "sr-only" : ""}>{item.label}</span>
            </Link></SidebarTooltip>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-slate-800 p-3">
        <SidebarTooltip label="ออกจากระบบ" disabled={!collapsed}><SuperAdminLogoutButton collapsed={collapsed} /></SidebarTooltip>
      </div>
    </aside>
  );
}
