import { Calendar, Download, Eye, Home, Image, MapPin, Newspaper, Phone } from "lucide-react";

export const PUBLIC_VILLAGE_NAV_ITEMS = (base: string) => [
  { href: base, label: "หน้าแรก", icon: Home },
  { href: `${base}/news`, label: "ข่าวสาร", icon: Newspaper },
  { href: `${base}/calendar`, label: "ปฏิทิน", icon: Calendar },
  { href: `${base}/gallery`, label: "แกลเลอรี", icon: Image },
  { href: `${base}/places`, label: "สถานที่", icon: MapPin },
  { href: `${base}/transparency`, label: "ความโปร่งใส", icon: Eye },
  { href: `${base}/downloads`, label: "เอกสาร", icon: Download },
  { href: `${base}/contacts`, label: "ติดต่อ", icon: Phone },
] as const;

export function isPublicVillageNavItemActive(pathname: string, href: string, base: string) {
  return href === base
    ? pathname === base || pathname === `${base}/`
    : pathname === href || pathname.startsWith(`${href}/`);
}
