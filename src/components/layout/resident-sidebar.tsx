"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { SidebarTooltip } from "@/components/ui/sidebar-tooltip";
import { BrandLogo } from "@/components/brand-logo";
import {
  Home,
  Newspaper,
  CalendarClock,
  CalendarDays,
  CircleAlert,
  ClipboardCheck,
  FileDown,
  FileSearch,
  UsersRound,
  Bell,
  User,
  BookmarkCheck,
  Images,
  Phone,
  MapPin,
  LockKeyhole,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export type ResidentMenuItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desktopPriority: number;
  mobilePriority: number;
  locked?: boolean;
};

export const residentMenuItems: ResidentMenuItem[] = [
  { href: "/resident/dashboard", label: "หน้าหลัก", icon: Home, desktopPriority: 1, mobilePriority: 1 },
  { href: "/resident/news", label: "ข่าว/ประกาศ", icon: Newspaper, desktopPriority: 2, mobilePriority: 2 },
  { href: "/resident/notifications", label: "การแจ้งเตือน", icon: Bell, desktopPriority: 3, mobilePriority: 3 },
  { href: "/resident/calendar", label: "ปฏิทิน", icon: CalendarDays, desktopPriority: 4, mobilePriority: 4 },
  { href: "/resident/binding", label: "ขอผูกเลขบ้าน", icon: ClipboardCheck, desktopPriority: 5, mobilePriority: 5 },
  { href: "/resident/appointments", label: "นัดหมาย", icon: CalendarClock, desktopPriority: 6, mobilePriority: 6 },
  { href: "/resident/issues", label: "แจ้งปัญหา", icon: CircleAlert, desktopPriority: 7, mobilePriority: 7 },
  { href: "/resident/gallery", label: "แกลเลอรี", icon: Images, desktopPriority: 8, mobilePriority: 8 },
  { href: "/resident/places", label: "สถานที่", icon: MapPin, desktopPriority: 9, mobilePriority: 9 },
  { href: "/resident/downloads", label: "เอกสารดาวน์โหลด", icon: FileDown, desktopPriority: 10, mobilePriority: 10 },
  { href: "/resident/transparency", label: "ความโปร่งใส", icon: FileSearch, desktopPriority: 11, mobilePriority: 11 },
  { href: "/resident/contacts", label: "ผู้ติดต่อ", icon: Phone, desktopPriority: 12, mobilePriority: 12 },
  { href: "/resident/household", label: "ข้อมูลครัวเรือน", icon: UsersRound, desktopPriority: 13, mobilePriority: 13 },
  { href: "/resident/saved", label: "รายการที่บันทึก", icon: BookmarkCheck, desktopPriority: 14, mobilePriority: 14 },
  { href: "/resident/profile", label: "โปรไฟล์", icon: User, desktopPriority: 15, mobilePriority: 15 },
];

export type ResidentNavigationState = {
  hasMembership: boolean;
  publicVillageBasePath?: string | null;
  bindingRequestHref?: string | null;
  bindingStatus?: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | null;
  bindingRejectReason?: string | null;
};

const MEMBERS_ONLY_PATHS = new Set([
  "/resident/issues",
  "/resident/appointments",
  "/resident/household",
  "/resident/saved",
]);

export function getResidentNavigationItems(state: ResidentNavigationState): ResidentMenuItem[] {
  const baseItems = state.hasMembership
    ? residentMenuItems.filter((item) => item.href !== "/resident/binding")
    : residentMenuItems;
  // The sidebar should start at the request form and only become a status link
  // after a request is actually waiting for review.
  const bindingHref = state.bindingStatus === "PENDING"
    ? "/resident/binding/pending"
    : "/resident/binding";

  return baseItems.map((item) => {
    if (!state.hasMembership) {
      if (MEMBERS_ONLY_PATHS.has(item.href)) {
        return {
          ...item,
          locked: true,
        };
      }
    }

    if (item.href !== "/resident/binding") {
      return item;
    }

    return {
      ...item,
      href: bindingHref,
      label: bindingHref === "/resident/binding/pending" ? "ดูสถานะคำขอผูกเลขบ้าน" : item.label,
    };
  });
}

export function ResidentSidebar({ state }: { state: ResidentNavigationState }) {
  const pathname = usePathname();
  const [lockedMenuLabel, setLockedMenuLabel] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { const frame = requestAnimationFrame(() => setCollapsed(localStorage.getItem("village-resident-sidebar-collapsed") === "true")); return () => cancelAnimationFrame(frame); }, []);
  const toggle = () => setCollapsed((value) => { localStorage.setItem("village-resident-sidebar-collapsed", String(!value)); return !value; });
  const navItems = getResidentNavigationItems(state);
  const desktopItems = [...navItems]
    .filter((item) => !(collapsed && item.locked))
    .sort((left, right) => left.desktopPriority - right.desktopPriority);
  return (
    <aside className={cn("sticky top-0 hidden h-screen overflow-hidden border-r border-gray-200 bg-white transition-[width] duration-200 flex-shrink-0 md:flex md:flex-col", collapsed ? "w-[72px]" : "w-60")}>
      <div className={cn("border-b border-gray-200", collapsed ? "p-3" : "p-4")}>
        <div className={cn("flex items-center gap-2", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed ? <Link href="/resident" className="flex min-w-0 items-center gap-2">
          <BrandLogo size="sm" alt="" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">พื้นที่ลูกบ้าน</p>
            {state.hasMembership ? (
              <p className="text-xs text-gray-500">เมนูใช้งานส่วนบุคคล</p>
            ) : (
              <div className="text-xs leading-5 text-gray-500">
                <p>โหมด guest</p>
                <p className="whitespace-nowrap">ยังไม่ผูกเลขบ้าน</p>
              </div>
            )}
          </div>
        </Link> : null}
          <button type="button" onClick={toggle} aria-label={collapsed ? "ขยายเมนู" : "ย่อเมนู"} aria-expanded={!collapsed} title={collapsed ? "ขยายเมนู" : "ย่อเมนู"} className="rounded p-1 text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2">{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>
        </div>
      </div>
      <nav className={cn("sidebar-scroll flex-1 space-y-1 overflow-y-auto", collapsed ? "p-3" : "p-4")}>
        {desktopItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <SidebarTooltip key={item.href} label={item.label} disabled={!collapsed}><Link
              href={item.href}
              onClick={(event) => {
                if (item.locked) {
                  event.preventDefault();
                  setLockedMenuLabel(item.label);
                }
              }}
              aria-label={item.label}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-green-50 text-green-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              <span className={cn("min-w-0 flex-1", collapsed && "sr-only")}>{item.label}</span>
              {item.locked && !collapsed ? <LockKeyhole className="h-3.5 w-3.5 text-amber-500" aria-label="ต้องผูกเลขบ้านก่อน" /> : null}
            </Link></SidebarTooltip>
          );
        })}
      </nav>
      <LockedResidentMenuDialog
        open={Boolean(lockedMenuLabel)}
        menuLabel={lockedMenuLabel}
        state={state}
        onClose={() => setLockedMenuLabel(null)}
      />
    </aside>
  );
}

export function LockedResidentMenuDialog({
  open,
  menuLabel,
  state,
  onClose,
}: {
  open: boolean;
  menuLabel: string | null;
  state: ResidentNavigationState;
  onClose: () => void;
}) {
  if (!open) return null;

  const isPending = state.bindingStatus === "PENDING";
  const isRejected = state.bindingStatus === "REJECTED";

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="locked-menu-title">
      <button className="absolute inset-0" type="button" aria-label="ยกเลิก" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl sm:p-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <h2 id="locked-menu-title" className="mt-4 text-lg font-semibold text-gray-900">ยังใช้เมนู {menuLabel} ไม่ได้</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          {isPending
            ? "คำขอของคุณกำลังรอผู้ใหญ่บ้านตรวจสอบ"
            : isRejected
              ? `คำขอผูกเลขบ้านถูกปฏิเสธ${state.bindingRejectReason ? `: ${state.bindingRejectReason}` : ""}`
              : "เมนูนี้ใช้ได้เฉพาะลูกบ้านที่ผูกเลขบ้านและได้รับการอนุมัติแล้ว"}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">ยกเลิก</button>
          <Link href={state.bindingRequestHref ?? "/resident/binding"} onClick={onClose} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
            {isPending ? "ดูสถานะคำขอ" : isRejected ? "แก้ไขคำขอและส่งใหม่" : "ไปขอผูกเลขบ้าน"}
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}
