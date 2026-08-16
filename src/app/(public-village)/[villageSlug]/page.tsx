import Link from "next/link";
import { Calendar, Compass, Eye, Globe, HeartPulse, Info, Mail, MapPin, Newspaper, Phone } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSlugVariants, normalizeVillageSlugParam } from "@/lib/village-slug";

interface PageProps {
  params: Promise<{ villageSlug: string }>;
}

/** Guest home: deliberately uses only village-managed public fields and public places. */
export default async function VillageHomePage({ params }: PageProps) {
  const { villageSlug: rawVillageSlug } = await params;
  const villageSlug = normalizeVillageSlugParam(rawVillageSlug);
  const village = await prisma.village.findFirst({
    where: { slug: { in: getSlugVariants(villageSlug) }, isActive: true },
    select: { id: true, name: true, description: true, address: true, phone: true, email: true, website: true },
  });
  if (!village) notFound();

  const [templeCount, clinicCount] = await Promise.all([
    prisma.villagePlace.count({ where: { villageId: village.id, category: "TEMPLE", isPublic: true } }),
    prisma.villagePlace.count({ where: { villageId: village.id, category: "CLINIC", isPublic: true } }),
  ]);

  const links = [
    { href: `/${villageSlug}/news`, icon: Newspaper, label: "ข่าวสาร" },
    { href: `/${villageSlug}/calendar`, icon: Calendar, label: "ปฏิทินกิจกรรม" },
    { href: `/${villageSlug}/transparency`, icon: Eye, label: "ความโปร่งใส" },
    { href: `/${villageSlug}/contacts`, icon: Phone, label: "ช่องทางติดต่อ" },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-800 p-5 text-white shadow-sm sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.13),transparent_48%)]" />
        <div className="relative">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-100">ข้อมูลสาธารณะของชุมชน</p>
          <h1 className="text-2xl font-bold sm:text-3xl">ยินดีต้อนรับสู่หมู่บ้าน {village.name}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">ข่าวสาร กิจกรรม และช่องทางติดต่อที่หมู่บ้านเผยแพร่สู่สาธารณะ</p>
        </div>
      </section>

      <nav aria-label="ข้อมูลสาธารณะ" className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {links.map((item) => <Link key={item.href} href={item.href} className="group rounded-xl border border-gray-200 bg-white p-4 text-center transition hover:border-emerald-300 hover:shadow-md sm:p-5">
          <span className="mx-auto mb-2 inline-flex rounded-xl bg-emerald-50 p-2.5"><item.icon className="h-5 w-5 text-emerald-700" /></span>
          <span className="block text-sm font-semibold text-gray-700 group-hover:text-emerald-800">{item.label}</span>
        </Link>)}
      </nav>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-5 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900"><Info className="h-5 w-5 text-emerald-700" />ข้อมูลสาธารณะของหมู่บ้าน</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {[
              { label: "วัดและศาสนสถาน", value: templeCount, icon: Compass, tone: "bg-emerald-50 text-emerald-700" },
              { label: "โรงพยาบาล/คลินิก", value: clinicCount, icon: HeartPulse, tone: "bg-sky-50 text-sky-700" },
            ].map((stat) => <div key={stat.label} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <span className={`rounded-xl p-2.5 ${stat.tone}`}><stat.icon className="h-5 w-5" /></span>
              <div><p className="text-xs font-medium text-gray-500">{stat.label}</p><p className="mt-0.5 text-xl font-bold text-gray-900">{stat.value}</p></div>
            </div>)}
          </div>
          <article className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
            <h3 className="font-semibold text-gray-900">เกี่ยวกับหมู่บ้าน</h3>
            <p className="mt-2 text-sm leading-6 text-gray-600">{village.description || `ยินดีต้อนรับสู่หมู่บ้าน ${village.name} แหล่งข้อมูลและบริการออนไลน์สำหรับชุมชน`}</p>
          </article>
        </section>

        <aside className="space-y-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900"><Phone className="h-5 w-5 text-emerald-700" />ช่องทางติดต่อสาธารณะ</h2>
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            {village.address && <div className="flex gap-3 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" /><span className="text-gray-600">{village.address}</span></div>}
            {village.phone && <div className="flex gap-3 text-sm"><Phone className="h-4 w-4 shrink-0 text-gray-400" /><a href={`tel:${village.phone}`} className="text-emerald-700 hover:underline">{village.phone}</a></div>}
            {village.email && <div className="flex gap-3 text-sm"><Mail className="h-4 w-4 shrink-0 text-gray-400" /><a href={`mailto:${village.email}`} className="break-all text-emerald-700 hover:underline">{village.email}</a></div>}
            {village.website && <div className="flex gap-3 text-sm"><Globe className="h-4 w-4 shrink-0 text-gray-400" /><a href={village.website} target="_blank" rel="noreferrer" className="break-all text-emerald-700 hover:underline">{village.website}</a></div>}
            {!village.address && !village.phone && !village.email && !village.website && <p className="text-sm text-gray-500">ยังไม่มีข้อมูลติดต่อสาธารณะ</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
