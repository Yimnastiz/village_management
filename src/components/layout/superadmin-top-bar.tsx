"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useMemo, useState } from "react";
import { SuperAdminLogoutButton } from "@/components/layout/superadmin-logout-button";
import { superAdminMenuItems } from "@/components/layout/superadmin-sidebar";
import { cn } from "@/lib/utils";
import { useAutoHideTopBar } from "@/components/layout/use-auto-hide-top-bar";
import { usePathname } from "next/navigation";

export function SuperAdminTopBar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const topBarHidden = useAutoHideTopBar(mobileMenuOpen || focusWithin);
  const mobileItems = useMemo(() => superAdminMenuItems, []);
  return <><header onFocusCapture={() => setFocusWithin(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false); }} className={cn("sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm transition-transform md:px-6 md:translate-y-0", topBarHidden ? "-translate-y-full" : "translate-y-0")}><div><p className="text-sm font-semibold text-slate-900">Super Admin</p><p className="text-xs text-slate-500">ผู้ดูแลระบบส่วนกลาง</p></div><div className="flex items-center gap-2"><button type="button" className="inline-flex rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden" onClick={() => setMobileMenuOpen(true)} aria-label="เปิดเมนู"><Menu className="h-5 w-5" /></button><div className="hidden text-right sm:block"><p className="text-sm font-medium text-slate-900">Super Admin</p><p className="text-xs text-slate-500">ผู้ดูแลระบบส่วนกลาง</p></div><SuperAdminLogoutButton /></div></header>{mobileMenuOpen ? <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true"><button type="button" className="absolute inset-0 bg-black/40" aria-label="ปิดเมนู" onClick={() => setMobileMenuOpen(false)} /><aside className="relative h-full w-72 max-w-[85vw] overflow-y-auto border-r border-slate-800 bg-slate-950 shadow-xl"><div className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><p className="text-sm font-semibold text-white">เมนู Super Admin</p><button type="button" className="rounded-md p-2 text-slate-300 hover:bg-slate-800" aria-label="ปิดเมนู" onClick={() => setMobileMenuOpen(false)}><X className="h-5 w-5" /></button></div><nav className="space-y-1 p-3">{mobileItems.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium", pathname === item.href || pathname.startsWith(`${item.href}/`) ? "bg-cyan-500/20 text-cyan-200" : "text-slate-200 hover:bg-slate-800")}><item.icon className="h-4 w-4" /><span>{item.label}</span></Link>)}</nav></aside></div> : null}</>;
}
