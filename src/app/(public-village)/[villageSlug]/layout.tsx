import Link from "next/link";
import { Home, Newspaper, Calendar, Image, Eye, Download, Siren, Phone } from "lucide-react";

interface VillageLayoutProps {
  children: React.ReactNode;
  params: Promise<{ villageSlug: string }>;
}

export default async function VillageLayout({ children, params }: VillageLayoutProps) {
  const { villageSlug } = await params;
  const base = `/${villageSlug}`;

  const navItems = [
    { href: base, label: "หน้าแรก", icon: Home },
    { href: `${base}/news`, label: "ข่าวสาร", icon: Newspaper },
    { href: `${base}/calendar`, label: "ปฏิทิน", icon: Calendar },
    { href: `${base}/gallery`, label: "แกลเลอรี", icon: Image },
    { href: `${base}/transparency`, label: "ความโปร่งใส", icon: Eye },
    { href: `${base}/downloads`, label: "ดาวน์โหลด", icon: Download },
    { href: `${base}/emergency`, label: "ฉุกเฉิน", icon: Siren },
    { href: `${base}/contacts`, label: "ติดต่อ", icon: Phone },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-green-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href={base} className="font-bold text-lg">หมู่บ้าน {villageSlug}</Link>
            <div className="flex items-center gap-3">
              <Link href="/auth/login" className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg">
                เข้าสู่ระบบ
              </Link>
            </div>
          </div>
        </div>
        <nav className="bg-green-800">
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
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="bg-green-900 text-green-100 py-6 text-center text-sm">
        <p>© {new Date().getFullYear()} ระบบหมู่บ้านอัจฉริยะ | หมู่บ้าน {villageSlug}</p>
      </footer>
    </div>
  );
}
