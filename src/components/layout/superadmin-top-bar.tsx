"use client";

import Link from "next/link";
import { ArrowLeft, HelpCircle, Info, Menu, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SuperAdminLogoutButton } from "@/components/layout/superadmin-logout-button";
import { useSuperAdminPageHeader } from "@/components/layout/superadmin-page-header-context";
import { superAdminMenuItems } from "@/components/layout/superadmin-sidebar";
import { cn } from "@/lib/utils";
import { useAutoHideTopBar } from "@/components/layout/use-auto-hide-top-bar";
import {
  isVillageWorkspaceLinkActive,
  villageWorkspaceHref,
  villageWorkspaceMenuGroups,
  villageWorkspaceOverview,
} from "@/app/superadmin/(protected)/villages/[villageId]/village-workspace-menu";

const pageHeaders = [
  { match: "/superadmin/dashboard", title: "ภาพรวมระบบ", description: "ติดตามสถานะหมู่บ้าน ผู้ใช้ และงานที่ต้องดำเนินการจากศูนย์กลาง" },
  { match: "/superadmin/villages", title: "จัดการหมู่บ้าน", description: "ค้นหาและจัดการหมู่บ้านที่เปิดใช้งานในระบบ" },
  { match: "/superadmin/users", title: "จัดการผู้ใช้", description: "ค้นหา ตรวจสอบ และจัดการสิทธิ์ผู้ใช้งานในระบบ" },
  { match: "/superadmin/data-quality", title: "Data Quality", description: "ตรวจสอบคุณภาพข้อมูลโดยระบบจะไม่แก้ไขข้อมูลอัตโนมัติ" },
  { match: "/superadmin/roles", title: "บทบาทและสิทธิ์", description: "จัดการสิทธิ์การเข้าถึงระดับระบบ" },
  { match: "/superadmin/broadcasts", title: "ประกาศทุกหมู่บ้าน", description: "สื่อสารประกาศส่วนกลางไปยังทุกหมู่บ้าน" },
  { match: "/superadmin/feedback", title: "Feedback จากผู้ใช้งาน", description: "ติดตามข้อเสนอแนะและประเด็นจากผู้ใช้งาน" },
  { match: "/superadmin/logs", title: "บันทึกกิจกรรมระบบ", description: "ตรวจสอบกิจกรรมสำคัญและประวัติการดำเนินการ" },
  { match: "/superadmin/settings", title: "ตั้งค่ากลางระบบ", description: "จัดการการตั้งค่าพื้นฐานของระบบ" },
  { match: "/superadmin/activities", title: "กิจกรรมระบบ", description: "ติดตามกิจกรรมส่วนกลางของระบบ" },
] as const;

function resolveHeader(pathname: string) {
  if (/^\/superadmin\/villages\/[^/]+/.test(pathname)) return { title: "พื้นที่ทำงานหมู่บ้าน", description: "จัดการข้อมูลและงานของหมู่บ้านที่เลือก" };
  return pageHeaders.find((item) => pathname === item.match || pathname.startsWith(`${item.match}/`)) ?? { title: "หน้าผู้ดูแลระบบ", description: "" };
}

export function SuperAdminTopBar() {
  const pathname = usePathname();
  const { action, context } = useSuperAdminPageHeader();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const mobileDrawerRef = useRef<HTMLElement>(null);
  const topBarHidden = useAutoHideTopBar(mobileMenuOpen || focusWithin);
  const mobileItems = useMemo(() => superAdminMenuItems, []);
  const header = context ?? resolveHeader(pathname);
  const workspace = context?.workspace;

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusFirstItem = () => mobileDrawerRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
    const frame = requestAnimationFrame(focusFirstItem);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(mobileDrawerRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [mobileMenuOpen]);

  const actionButton = action ? (
    <button type="button" onClick={action.onClick} aria-label={action.label} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-cyan-600 px-3 text-sm font-medium text-white hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2">
      <Plus className="h-4 w-4" />
      <span className="hidden sm:inline">{action.label}</span>
    </button>
  ) : null;

  return <>
    <header onFocusCapture={() => setFocusWithin(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false); }} className={cn("sticky top-0 z-40 flex min-h-16 items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 shadow-sm transition-transform md:gap-3 md:px-6 md:translate-y-0", topBarHidden ? "-translate-y-full" : "translate-y-0")}>
      <button type="button" className="inline-flex shrink-0 rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden" onClick={() => setMobileMenuOpen(true)} aria-label="เปิดเมนู"><Menu className="h-5 w-5" /></button>
      {workspace ? <>
        <Link href="/superadmin/villages" aria-label="กลับรายการหมู่บ้าน" title="กลับรายการหมู่บ้าน" className="inline-flex shrink-0 items-center gap-2 rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          <span className="hidden lg:inline text-sm font-medium">กลับรายการหมู่บ้าน</span>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">{header.title}</h1>
          <p className="hidden truncate text-sm text-slate-500 sm:block">{workspace.location}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span title="การแก้ไขสำคัญจะถูกบันทึกในบันทึกการใช้งานของหมู่บ้านนี้" className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600">
            <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden lg:inline">โหมดช่วยเหลือ</span>
            <Info className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          </span>
          <span className={cn("hidden items-center gap-1.5 text-xs font-medium sm:inline-flex", workspace.isActive ? "text-emerald-700" : "text-slate-500")}>
            <span className={cn("h-1.5 w-1.5 rounded-full", workspace.isActive ? "bg-emerald-500" : "bg-slate-400")} />
            {workspace.isActive ? "หมู่บ้านเปิดใช้งาน" : "หมู่บ้านปิดใช้งาน"}
          </span>
          {actionButton}
        </div>
      </> : <>
        <div className="min-w-0 flex-1"><h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">{header.title}</h1>{header.description ? <p className="hidden truncate text-sm text-slate-500 sm:block">{header.description}</p> : null}</div>
        {actionButton}
      </>}
    </header>

    {mobileMenuOpen ? <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="เมนูนำทาง">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="ปิดเมนู" onClick={() => setMobileMenuOpen(false)} />
      <aside ref={mobileDrawerRef} className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-slate-800 bg-slate-950 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><p className="text-sm font-semibold text-white">เมนู</p><button type="button" className="rounded-md p-2 text-slate-300 hover:bg-slate-800" aria-label="ปิดเมนู" onClick={() => setMobileMenuOpen(false)}><X className="h-5 w-5" /></button></div>
        <nav className="sidebar-scroll flex-1 overflow-y-auto p-3" aria-label="เมนู SuperAdmin">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">เมนูระบบ</p>
          <div className="space-y-1">{mobileItems.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium", pathname === item.href || pathname.startsWith(`${item.href}/`) ? "bg-cyan-500/20 text-cyan-200" : "text-slate-200 hover:bg-slate-800")}><item.icon className="h-4 w-4" aria-hidden="true" /><span>{item.label}</span></Link>)}</div>
          {workspace ? <div className="mt-4 border-t border-slate-800 pt-4">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">หมู่บ้านปัจจุบัน</p>
            <div className="space-y-1">
              {(() => {
                const href = villageWorkspaceHref(workspace.villageId, villageWorkspaceOverview.slug);
                const active = isVillageWorkspaceLinkActive(pathname, href);
                return <Link href={href} onClick={() => setMobileMenuOpen(false)} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium", active ? "bg-cyan-500/20 text-cyan-200" : "text-slate-200 hover:bg-slate-800")}><villageWorkspaceOverview.icon className="h-4 w-4" aria-hidden="true" /><span>{villageWorkspaceOverview.label}</span></Link>;
              })()}
              {villageWorkspaceMenuGroups.map((group) => <div key={group.label} className="pt-3">
                <p className="px-3 pb-1 text-[11px] font-semibold text-slate-500">{group.label}</p>
                {group.links.map((item) => {
                  const href = villageWorkspaceHref(workspace.villageId, item.slug);
                  const active = isVillageWorkspaceLinkActive(pathname, href);
                  return <Link key={item.slug} href={href} onClick={() => setMobileMenuOpen(false)} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium", active ? "bg-cyan-500/20 text-cyan-200" : "text-slate-200 hover:bg-slate-800")}><item.icon className="h-4 w-4" aria-hidden="true" /><span>{item.label}</span></Link>;
                })}
              </div>)}
            </div>
          </div> : null}
        </nav>
        <div className="border-t border-slate-800 p-3"><SuperAdminLogoutButton /></div>
      </aside>
    </div> : null}
  </>;
}
