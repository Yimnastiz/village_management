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
  PhoneCall,
  BookmarkCheck,
  Eye,
  FileClock,
  Download,
  Images,
} from "lucide-react";

const navItems = [
  { href: "/resident/dashboard", label: "หน้าหลัก", icon: Home },
  { href: "/resident/news", label: "ข่าว/ประกาศ", icon: Newspaper },
  { href: "/resident/news/requests", label: "คำขอข่าว", icon: FileClock },
  { href: "/resident/issues", label: "แจ้งปัญหา", icon: AlertCircle },
  { href: "/resident/calendar", label: "กิจกรรมหมู่บ้าน", icon: CalendarDays },
  { href: "/resident/appointments", label: "นัดหมาย", icon: Calendar },
  { href: "/resident/gallery", label: "แกลเลอรี", icon: Images },
  { href: "/resident/downloads", label: "เอกสารดาวน์โหลด", icon: Download },
  { href: "/resident/household", label: "ข้อมูลครัวเรือน", icon: Users },
  { href: "/resident/transparency", label: "ความโปร่งใส", icon: Eye },
  { href: "/resident/notifications", label: "การแจ้งเตือน", icon: Bell },
  { href: "/resident/saved", label: "รายการที่บันทึก", icon: BookmarkCheck },
  { href: "/resident/profile", label: "โปรไฟล์", icon: User },
  { href: "/resident/sos", label: "SOS ฉุกเฉิน", icon: PhoneCall },
];

export function ResidentSidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col min-h-screen">
      <div className="p-4 border-b border-gray-200">
        <Link href="/resident" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
            <Home className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">พื้นที่ลูกบ้าน</p>
          </div>
        </Link>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
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
