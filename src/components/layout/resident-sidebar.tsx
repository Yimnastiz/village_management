"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  Newspaper,
  AlertCircle,
  Calendar,
  CalendarDays,
  Users,
  Bell,
  User,
  BookmarkCheck,
  Eye,
  FileClock,
  Download,
  Images,
  Phone,
} from "lucide-react";

export type ResidentMenuItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desktopPriority: number;
  mobilePriority: number;
};

export const residentMenuItems: ResidentMenuItem[] = [
  { href: "/resident/dashboard", label: "หน้าหลัก", icon: Home, desktopPriority: 1, mobilePriority: 1 },
  { href: "/resident/news", label: "ข่าว/ประกาศ", icon: Newspaper, desktopPriority: 2, mobilePriority: 3 },
  { href: "/resident/notifications", label: "การแจ้งเตือน", icon: Bell, desktopPriority: 3, mobilePriority: 4 },
  { href: "/resident/issues", label: "แจ้งปัญหา", icon: AlertCircle, desktopPriority: 4, mobilePriority: 5 },
  { href: "/resident/appointments", label: "นัดหมาย", icon: Calendar, desktopPriority: 5, mobilePriority: 6 },
  { href: "/resident/calendar", label: "กิจกรรมหมู่บ้าน", icon: CalendarDays, desktopPriority: 6, mobilePriority: 7 },
  { href: "/resident/household", label: "ข้อมูลครัวเรือน", icon: Users, desktopPriority: 7, mobilePriority: 8 },
  { href: "/resident/downloads", label: "เอกสารดาวน์โหลด", icon: Download, desktopPriority: 8, mobilePriority: 9 },
  { href: "/resident/transparency", label: "ความโปร่งใส", icon: Eye, desktopPriority: 9, mobilePriority: 10 },
  { href: "/resident/gallery", label: "แกลเลอรี", icon: Images, desktopPriority: 10, mobilePriority: 11 },
  { href: "/resident/contacts", label: "ผู้ติดต่อ", icon: Phone, desktopPriority: 11, mobilePriority: 12 },
  { href: "/resident/saved", label: "รายการที่บันทึก", icon: BookmarkCheck, desktopPriority: 12, mobilePriority: 13 },
  { href: "/resident/profile", label: "โปรไฟล์", icon: User, desktopPriority: 13, mobilePriority: 14 },
  { href: "/resident/news/requests", label: "คำขอข่าว", icon: FileClock, desktopPriority: 14, mobilePriority: 15 },
];

const desktopNavItems = [...residentMenuItems].sort(
  (left, right) => left.desktopPriority - right.desktopPriority
);

export function ResidentSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 bg-white border-r border-gray-200 flex-shrink-0 md:flex flex-col min-h-screen">
      <div className="p-4 border-b border-gray-200">
        <Link href="/resident" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
            <Home className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">พื้นที่ลูกบ้าน</p>
            <p className="text-xs text-gray-500">เมนูใช้งานส่วนบุคคล</p>
          </div>
        </Link>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {desktopNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-green-50 text-green-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
