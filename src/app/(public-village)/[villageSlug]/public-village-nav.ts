import { Calendar, Download, Eye, Home, Image, MapPin, Newspaper, Phone } from "lucide-react";

export const PUBLIC_VILLAGE_NAV_ITEMS = (base: string) => [
  { href: base, label: "หน้าแรก", icon: Home },
  { href: `${base}/news`, label: "ข่าวสาร", icon: Newspaper },
  { href: `${base}/calendar`, label: "ปฏิทิน", icon: Calendar },
  { href: `${base}/gallery`, label: "แกลเลอรี", icon: Image },
  { href: `${base}/places`, label: "สถานที่", icon: MapPin },
  { href: `${base}/downloads`, label: "เอกสาร", icon: Download },
  { href: `${base}/transparency`, label: "ความโปร่งใส", icon: Eye },
  { href: `${base}/contacts`, label: "ติดต่อ", icon: Phone },
] as const;

function normalizePathname(pathname: string) {
  let normalized = pathname;
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // Keep the browser pathname when it contains an incomplete escape sequence.
  }
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
}

export function isPublicVillageNavItemActive(pathname: string, href: string, base: string) {
  const currentPath = normalizePathname(pathname);
  const itemPath = normalizePathname(href);
  const villageRoot = normalizePathname(base);
  const isHome = itemPath === villageRoot;

  return isHome
    ? currentPath === itemPath
    : currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}
