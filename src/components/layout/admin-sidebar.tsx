"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { SidebarTooltip } from "@/components/ui/sidebar-tooltip";
import {
  LayoutDashboard,
  Newspaper,
  AlertCircle,
  Calendar,
  Image,
  Users,
  Download,
  Eye,
  Phone,
  Settings,
  Shield,
  Bell,
  Upload,
  MapPin,
  ClipboardList,
  ClipboardCheck,
  House,
  UsersRound,
  Link2,
  FileUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export type AdminMenuItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export const adminMenuItems: AdminMenuItem[] = [
  { href: "/admin/dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
  { href: "/admin/news", label: "ข่าว/ประกาศ", icon: Newspaper },
  { href: "/admin/calendar", label: "ปฏิทิน", icon: Calendar },
  { href: "/admin/gallery", label: "แกลเลอรี", icon: Image },
  { href: "/admin/places", label: "สถานที่สำคัญ", icon: MapPin },
  { href: "/admin/contacts", label: "รายชื่อผู้ติดต่อ", icon: Phone },
  { href: "/admin/issues", label: "ปัญหา/คำร้อง", icon: AlertCircle },
  { href: "/admin/appointments", label: "นัดหมาย", icon: Calendar },
  { href: "/admin/population", label: "ทะเบียนครัวเรือน", icon: UsersRound },
  { href: "/admin/population/houses", label: "ทะเบียนบ้าน", icon: House },
  { href: "/admin/population/people", label: "ทะเบียนประชากร", icon: Users },
  { href: "/admin/population/binding-requests", label: "คำขอผูกเลขบ้าน", icon: Link2 },
  { href: "/admin/population/import", label: "นำเข้า/ส่งออกข้อมูล", icon: FileUp },
  { href: "/admin/transparency", label: "ความโปร่งใส", icon: Eye },
  { href: "/admin/downloads", label: "เอกสารดาวน์โหลด", icon: Download },
  { href: "/admin/notifications", label: "การแจ้งเตือน", icon: Bell },
  { href: "/admin/settings", label: "ตั้งค่า", icon: Settings },
  { href: "/admin/security", label: "ความปลอดภัย", icon: Shield },
];

const populationMenuItems = adminMenuItems.filter((item) => item.href.startsWith("/admin/population/") && item.href !== "/admin/population");
const primaryMenuItems = adminMenuItems.filter((item) => !item.href.startsWith("/admin/population/"));
const isItemActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);
const getActiveHref = (pathname: string) => [...adminMenuItems].filter((item) => isItemActive(pathname, item.href)).sort((left, right) => right.href.length - left.href.length)[0]?.href;

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [populationOpen, setPopulationOpen] = useState(false);
  const populationActive = pathname === "/admin/population" || pathname.startsWith("/admin/population/");
  const populationOverviewActive = pathname === "/admin/population";
  useEffect(() => { if (populationActive) setPopulationOpen(true); }, [populationActive]);
  useEffect(() => { const frame = requestAnimationFrame(() => setCollapsed(localStorage.getItem("village-admin-sidebar-collapsed") === "true")); return () => cancelAnimationFrame(frame); }, []);
  const toggle = () => setCollapsed((value) => { localStorage.setItem("village-admin-sidebar-collapsed", String(!value)); return !value; });
  return (
    <aside className={cn("sticky top-0 hidden h-screen overflow-hidden bg-gray-900 text-gray-300 transition-[width] duration-200 flex-shrink-0 md:flex md:flex-col", collapsed ? "w-[72px]" : "w-60")}>
      <div className={cn("border-b border-gray-700", collapsed ? "p-3" : "p-4")}>
        <div className={cn("flex items-center gap-2", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed ? <Link href="/admin" className="flex min-w-0 items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <LayoutDashboard className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">พื้นที่ผู้ใหญ่บ้าน</p>
            <p className="text-xs text-gray-400">จัดการข้อมูลหมู่บ้าน</p>
          </div>
        </Link> : null}
          <button type="button" onClick={toggle} aria-label={collapsed ? "ขยายเมนู" : "ย่อเมนู"} aria-expanded={!collapsed} title={collapsed ? "ขยายเมนู" : "ย่อเมนู"} className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900">{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>
        </div>
      </div>
      <nav className={cn("sidebar-scroll flex-1 space-y-1 overflow-y-auto", collapsed ? "p-3" : "p-4")}>
        {primaryMenuItems.map((item) => {
          if (item.href === "/admin/population") {
            return <div key={item.href} className="space-y-1"><div className="flex items-center"><SidebarTooltip label="ทะเบียนครัวเรือน" disabled={!collapsed}><Link href={item.href} aria-label="ทะเบียนครัวเรือน" className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", populationOverviewActive ? "bg-gray-700 text-white" : populationActive ? "text-gray-200" : "text-gray-400 hover:bg-gray-800 hover:text-white")}><UsersRound className="h-4 w-4 shrink-0" /><span className={collapsed ? "sr-only" : ""}>ทะเบียนครัวเรือน</span></Link></SidebarTooltip>{!collapsed ? <button type="button" onClick={() => setPopulationOpen(value => !value)} aria-label={populationOpen ? "ย่อเมนูทะเบียนครัวเรือน" : "ขยายเมนูทะเบียนครัวเรือน"} aria-expanded={populationOpen} className="mr-1 rounded p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"><ChevronRight className={cn("h-4 w-4 transition-transform duration-150", populationOpen ? "rotate-90" : "")} /></button> : null}</div>{!collapsed && <div className={cn("grid overflow-hidden transition-[grid-template-rows] duration-150", populationOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}><div className="min-h-0 space-y-1">{populationMenuItems.map((child) => { const active = getActiveHref(pathname) === child.href; return <Link key={child.href} href={child.href} className={cn("ml-4 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", active ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white")}><child.icon className="h-4 w-4 shrink-0" />{child.label}</Link>; })}</div></div>}</div>;
          }
          const isActive = getActiveHref(pathname) === item.href;
          return (
            <SidebarTooltip key={item.href} label={item.label} disabled={!collapsed}><Link
              href={item.href}
              aria-label={item.label}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              <span className={collapsed ? "sr-only" : ""}>{item.label}</span>
            </Link></SidebarTooltip>
          );
        })}
      </nav>
    </aside>
  );
}
