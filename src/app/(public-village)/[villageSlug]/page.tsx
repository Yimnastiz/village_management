import Link from "next/link";
import { Newspaper, Calendar, Eye, Phone, Users, Home as HomeIcon, Compass, HeartPulse, UserCheck, MapPin, Mail, Info } from "lucide-react";
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
    select: {
      id: true,
      name: true,
      description: true,
      address: true,
      phone: true,
      email: true,
    },
  });
  if (!village) notFound();

  const [residentCount, houseCount, templeCount, clinicCount, headmanMembership] = await Promise.all([
    prisma.person.count({ where: { villageId: village.id, status: "ACTIVE" } }),
    prisma.house.count({ where: { villageId: village.id } }),
    prisma.villagePlace.count({ where: { villageId: village.id, category: "TEMPLE", isPublic: true } }),
    prisma.villagePlace.count({ where: { villageId: village.id, category: "CLINIC", isPublic: true } }),
    prisma.villageMembership.findFirst({
      where: { villageId: village.id, role: "HEADMAN", status: "ACTIVE" },
      include: { user: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      {/* Banner */}
      <div className="bg-gradient-to-r from-green-600 to-green-800 rounded-2xl p-8 text-white shadow-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent_50%)]" />
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">ยินดีต้อนรับสู่หมู่บ้าน {village.name}</h1>
          <p className="text-green-100 text-sm sm:text-base">ข้อมูล ข่าวสาร และบริการสำหรับชุมชนแบบครบวงจร</p>
        </div>
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
            className="bg-white rounded-xl border border-gray-200 p-6 text-center hover:shadow-md hover:border-green-300 transition-all duration-200 group"
          >
            <div className="inline-flex p-3 bg-green-50 rounded-xl mb-3 group-hover:bg-green-100 transition-colors">
              <item.icon className="h-5 w-5 text-green-600 group-hover:scale-110 transition-transform" />
            </div>
            <p className="text-sm font-semibold text-gray-700 group-hover:text-green-700 transition-colors">{item.label}</p>
          </Link>
        ))}
      </div>

      {/* Info & Stats Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Quick Stats */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Info className="h-5 w-5 text-green-600" />
            สถิติและข้อมูลพื้นฐานของหมู่บ้าน
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "ประชากร (คน)", value: residentCount, icon: Users, color: "from-blue-500 to-indigo-600", bg: "bg-blue-50" },
              { label: "ครัวเรือน (หลัง)", value: houseCount, icon: HomeIcon, color: "from-amber-500 to-orange-600", bg: "bg-amber-50" },
              { label: "วัดและศาสนสถาน (แห่ง)", value: templeCount, icon: Compass, color: "from-emerald-500 to-teal-600", bg: "bg-emerald-50" },
              { label: "โรงพยาบาล/คลินิก (แห่ง)", value: clinicCount, icon: HeartPulse, color: "from-rose-500 to-pink-600", bg: "bg-rose-50" },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow"
              >
                <div className={`p-3 rounded-lg ${stat.bg}`}>
                  <stat.icon className="h-6 w-6 text-gray-700" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">{stat.label}</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-800 mt-0.5">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Description / About */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              เกี่ยวกับหมู่บ้าน
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              {village.description || `ยินดีต้อนรับสู่หมู่บ้าน ${village.name} แหล่งข้อมูลและบริการออนไลน์ที่มุ่งอำนวยความสะดวกให้แก่ทุกคนในชุมชน`}
            </p>
          </div>
        </div>

        {/* Right: Headman & Contact Details */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-green-600" />
            ผู้ใหญ่บ้านและติดต่อ
          </h2>

          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6 shadow-sm">
            {/* Headman Profile */}
            <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
              <div className="h-14 w-14 rounded-full bg-green-50 border border-green-200 flex items-center justify-center text-green-700 font-bold text-lg shrink-0">
                {headmanMembership?.user?.name ? headmanMembership.user.name.charAt(0) : "ผ"}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">ผู้ใหญ่บ้าน</p>
                <p className="font-bold text-gray-900 truncate mt-0.5">
                  {headmanMembership?.user?.name || "ไม่ระบุข้อมูล"}
                </p>
                {headmanMembership?.user?.phoneNumber && (
                  <p className="text-xs text-gray-500 mt-1">โทร: {headmanMembership.user.phoneNumber}</p>
                )}
              </div>
            </div>

            {/* General Contact Info */}
            <div className="space-y-3 text-sm">
              {village.address && (
                <div className="flex gap-3">
                  <MapPin className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-700">ที่ทำการหมู่บ้าน</p>
                    <p className="text-xs text-gray-500 mt-0.5">{village.address}</p>
                  </div>
                </div>
              )}
              {village.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">เบอร์โทรศัพท์: {village.phone}</p>
                  </div>
                </div>
              )}
              {village.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">อีเมล: {village.email}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

