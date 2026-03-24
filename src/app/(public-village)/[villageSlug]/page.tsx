import Link from "next/link";
import { Newspaper, Calendar, Eye, Phone } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { normalizeVillageSlugParam, getSlugVariants } from "@/lib/village-slug";

interface PageProps {
  params: Promise<{ villageSlug: string }>;
}

export default async function VillageHomePage({ params }: PageProps) {
  const { villageSlug: rawVillageSlug } = await params;
  const villageSlug = normalizeVillageSlugParam(rawVillageSlug);

  const village = await prisma.village.findFirst({
    where: { slug: { in: getSlugVariants(villageSlug) } },
    select: { name: true },
  });
  if (!village) notFound();

  return (
    <div className="space-y-8">
      {/* Banner */}
      <div className="bg-gradient-to-r from-green-600 to-green-800 rounded-2xl p-8 text-white">
        <h1 className="text-2xl font-bold mb-2">ยินดีต้อนรับสู่หมู่บ้าน {village.name}</h1>
        <p className="text-green-100">ข้อมูล ข่าวสาร และบริการสำหรับชุมชน</p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { href: `/${villageSlug}/news`, icon: Newspaper, label: "ข่าวสาร" },
          { href: `/${villageSlug}/calendar`, icon: Calendar, label: "ปฏิทินกิจกรรม" },
          { href: `/${villageSlug}/transparency`, icon: Eye, label: "ความโปร่งใส" },
          { href: `/${villageSlug}/contacts`, icon: Phone, label: "ติดต่อ" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-white rounded-xl border border-gray-200 p-6 text-center hover:shadow-md transition-shadow"
          >
            <div className="inline-flex p-3 bg-green-50 rounded-xl mb-3">
              <item.icon className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-sm font-medium text-gray-700">{item.label}</p>
          </Link>
        ))}
      </div>

      {/* Announcement */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-green-600" />
          ประกาศล่าสุด
        </h2>
        <p className="text-sm text-gray-500 text-center py-6">ยังไม่มีประกาศในขณะนี้</p>
      </div>
    </div>
  );
}
