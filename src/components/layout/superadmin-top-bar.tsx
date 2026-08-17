"use client";

import Link from "next/link";
import { Menu, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { SuperAdminLogoutButton } from "@/components/layout/superadmin-logout-button";
import { useSuperAdminPageHeader } from "@/components/layout/superadmin-page-header-context";
import { superAdminMenuItems } from "@/components/layout/superadmin-sidebar";
import { cn } from "@/lib/utils";
import { useAutoHideTopBar } from "@/components/layout/use-auto-hide-top-bar";

const pageHeaders = [
  { match: "/superadmin/dashboard", title: "ภาพรวมระบบ", description: "ติดตามสถานะหมู่บ้าน ผู้ใช้ และงานที่ต้องดำเนินการจากศูนย์กลาง" },
  { match: "/superadmin/villages", title: "จัดการหมู่บ้าน", description: "ค้นหาและจัดการหมู่บ้านที่เปิดใช้งานในระบบ" },
  { match: "/superadmin/users", title: "จัดการผู้ใช้", description: "ค้นหา ตรวจสอบ และจัดการสิทธิ์ผู้ใช้งานในระบบ" },
  { match: "/superadmin/data-quality", title: "Data Quality", description: "ตรวจสอบคุณภาพข้อมูลโดยระบบจะไม่แก้ไขข้อมูลอัตโนมัติ" },
  { match: "/superadmin/roles", title: "บทบาทและสิทธิ์", description: "จัดการสิทธิ์การเข้าถึงระดับระบบ" },
  { match: "/superadmin/broadcasts", title: "ประกาศไปทุกหมู่บ้าน", description: "สื่อสารประกาศส่วนกลางไปยังทุกหมู่บ้าน" },
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
  const topBarHidden = useAutoHideTopBar(mobileMenuOpen || focusWithin);
  const mobileItems = useMemo(() => superAdminMenuItems, []);
  const header = context ?? resolveHeader(pathname);

  return <>
    <header onFocusCapture={() => setFocusWithin(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false); }} className={cn("sticky top-0 z-40 flex min-h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 shadow-sm transition-transform md:px-6 md:translate-y-0", topBarHidden ? "-translate-y-full" : "translate-y-0")}>
      <button type="button" className="inline-flex shrink-0 rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden" onClick={() => setMobileMenuOpen(true)} aria-label="เปิดเมนู"><Menu className="h-5 w-5" /></button>
      <div className="min-w-0 flex-1"><h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">{header.title}</h1>{header.description ? <p className="hidden truncate text-sm text-slate-500 sm:block">{header.description}</p> : null}</div>
      {action ? <button type="button" onClick={action.onClick} aria-label={action.label} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-cyan-600 px-3 text-sm font-medium text-white hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2"><Plus className="h-4 w-4" /><span className="hidden sm:inline">{action.label}</span></button> : null}
    </header>
    {mobileMenuOpen ? <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true"><button type="button" className="absolute inset-0 bg-black/40" aria-label="ปิดเมนู" onClick={() => setMobileMenuOpen(false)} /><aside className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-slate-800 bg-slate-950 shadow-xl"><div className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><p className="text-sm font-semibold text-white">เมนู</p><button type="button" className="rounded-md p-2 text-slate-300 hover:bg-slate-800" aria-label="ปิดเมนู" onClick={() => setMobileMenuOpen(false)}><X className="h-5 w-5" /></button></div><nav className="flex-1 space-y-1 overflow-y-auto p-3">{mobileItems.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium", pathname === item.href || pathname.startsWith(`${item.href}/`) ? "bg-cyan-500/20 text-cyan-200" : "text-slate-200 hover:bg-slate-800")}><item.icon className="h-4 w-4" /><span>{item.label}</span></Link>)}</nav><div className="border-t border-slate-800 p-3"><SuperAdminLogoutButton /></div></aside></div> : null}
  </>;
}
