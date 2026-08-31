import type { LucideIcon } from "lucide-react";
import {
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  Contact,
  Download,
  FileCheck,
  FileDown,
  History,
  House,
  Images,
  LayoutDashboard,
  MapPin,
  MessageSquareWarning,
  Newspaper,
  Upload,
  UserRound,
  Users,
} from "lucide-react";

export type VillageWorkspaceMenuLink = {
  slug: string;
  label: string;
  icon: LucideIcon;
};

export type VillageWorkspaceMenuGroup = {
  label: string;
  links: VillageWorkspaceMenuLink[];
};

export const villageWorkspaceOverview: VillageWorkspaceMenuLink = {
  slug: "overview",
  label: "ภาพรวม",
  icon: LayoutDashboard,
};

export const villageWorkspaceMenuGroups: VillageWorkspaceMenuGroup[] = [
  {
    label: "ประชากรและทะเบียน",
    links: [
      { slug: "houses", label: "บ้าน", icon: House },
      { slug: "people", label: "ประชากร", icon: Users },
      { slug: "binding-requests", label: "คำขอผูกบ้าน", icon: ClipboardCheck },
      { slug: "population/import", label: "นำเข้าข้อมูล", icon: Upload },
      { slug: "population/export", label: "ส่งออกข้อมูล", icon: Download },
    ],
  },
  {
    label: "ผู้ดูแลและสมาชิก",
    links: [
      { slug: "admins", label: "ผู้ดูแลหมู่บ้าน", icon: UserRound },
      { slug: "users", label: "สมาชิก", icon: Users },
    ],
  },
  {
    label: "การดำเนินงาน",
    links: [
      { slug: "issues", label: "ปัญหา", icon: MessageSquareWarning },
      { slug: "appointments", label: "นัดหมาย", icon: CalendarCheck },
      { slug: "calendar", label: "ปฏิทิน", icon: CalendarDays },
    ],
  },
  {
    label: "เนื้อหาหมู่บ้าน",
    links: [
      { slug: "news", label: "ข่าวสาร", icon: Newspaper },
      { slug: "gallery", label: "แกลเลอรี", icon: Images },
      { slug: "places", label: "สถานที่", icon: MapPin },
      { slug: "contacts", label: "ผู้ติดต่อ", icon: Contact },
      { slug: "downloads", label: "ดาวน์โหลด", icon: FileDown },
      { slug: "transparency", label: "ความโปร่งใส", icon: FileCheck },
    ],
  },
  {
    label: "ระบบ",
    links: [{ slug: "audit", label: "บันทึกการใช้งาน", icon: History }],
  },
];

export function villageWorkspaceHref(villageId: string, slug: string) {
  return `/superadmin/villages/${villageId}/${slug}`;
}

export function isVillageWorkspaceLinkActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
