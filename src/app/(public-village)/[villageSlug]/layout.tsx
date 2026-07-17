import Link from "next/link";
import { Home, Newspaper, Calendar, Image, Eye, Download, Phone, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { normalizeVillageSlugParam } from "@/lib/village-slug";
import { VillageSwitcher } from "./village-switcher";
import { VillagePublicMobileNav } from "./village-mobile-nav";

interface VillageLayoutProps {
  children: React.ReactNode;
  params: Promise<{ villageSlug: string }>;
}

export default async function VillageLayout({ children, params }: VillageLayoutProps) {
  const { villageSlug: rawVillageSlug } = await params;
  const villageSlug = normalizeVillageSlugParam(rawVillageSlug);
  const base = `/${villageSlug}`;

  const villages = await prisma.village.findMany({
    where: { isActive: true },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
    },
  });

  const navItems = [
    { href: base, label: "หน้าแรก", icon: Home },
    { href: `${base}/news`, label: "ข่าวสาร", icon: Newspaper },
    { href: `${base}/calendar`, label: "ปฏิทิน", icon: Calendar },
    { href: `${base}/gallery`, label: "แกลเลอรี", icon: Image },
    { href: `${base}/places`, label: "สถานที่", icon: MapPin },
    { href: `${base}/transparency`, label: "ความโปร่งใส", icon: Eye },
    { href: `${base}/downloads`, label: "ดาวน์โหลด", icon: Download },
    { href: `${base}/contacts`, label: "ติดต่อ", icon: Phone },
  ];

  const villageName = villages.find((v) => v.slug === villageSlug)?.name ?? villageSlug;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-green-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-3">
            <Link href={base} className="min-w-0 font-bold text-base sm:text-lg truncate">
              หมู่บ้าน {villageName}
            </Link>

            {/* Desktop: village switcher + action links */}
            <div className="hidden md:flex items-center gap-3">
              <VillageSwitcher villages={villages} currentSlug={villageSlug} />
              <Link href="/" className="text-xs sm:text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg whitespace-nowrap">
                หน้าค้นหาหมู่บ้าน
              </Link>
              <Link href="/auth/login" className="text-xs sm:text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg whitespace-nowrap">
                เข้าสู่ระบบ
              </Link>
            </div>

            {/* Mobile: hamburger button */}
            <VillagePublicMobileNav
              base={base}
              villageName={villageName}
              villages={villages}
              currentSlug={villageSlug}
            />
          </div>
        </div>

        {/* Desktop only: horizontal tab nav */}
        <nav className="hidden md:block bg-green-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex overflow-x-auto">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-1.5 px-4 py-3 text-sm text-green-100 hover:text-white hover:bg-green-700 whitespace-nowrap"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>
      <footer className="bg-green-900 text-green-100 py-6 text-center text-sm">
        <p>© {new Date().getFullYear()} ระบบหมู่บ้านอัจฉริยะ | หมู่บ้าน {villageName}</p>
      </footer>
    </div>
  );
}
