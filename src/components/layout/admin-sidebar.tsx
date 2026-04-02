"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
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
  { href: "/admin/contacts", label: "รายชื่อผู้ติดต่อ", icon: Phone },
  { href: "/admin/issues", label: "ปัญหา/คำร้อง", icon: AlertCircle },
  { href: "/admin/appointments", label: "นัดหมาย", icon: Calendar },
  { href: "/admin/population", label: "ทะเบียนครัวเรือน", icon: Users },
  { href: "/admin/population/import", label: "นำเข้า/ส่งออกข้อมูล", icon: Upload },
  { href: "/admin/transparency", label: "ความโปร่งใส", icon: Eye },
  { href: "/admin/downloads", label: "เอกสารดาวน์โหลด", icon: Download },
  { href: "/admin/notifications", label: "การแจ้งเตือน", icon: Bell },
  { href: "/admin/settings", label: "ตั้งค่า", icon: Settings },
  { href: "/admin/security", label: "ความปลอดภัย", icon: Shield },
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-64 overflow-y-auto bg-gray-900 text-gray-300 flex-shrink-0 md:flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <LayoutDashboard className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">ระบบผู้ดูแล</p>
          </div>
        </Link>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {adminMenuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
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
