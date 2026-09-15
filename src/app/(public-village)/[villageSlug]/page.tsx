import Link from "next/link";
import { Calendar, Compass, ExternalLink, Eye, Globe, HeartPulse, Home, Info, Landmark, Mail, MapPin, Newspaper, Phone, School, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { VillagePlaceCategory } from "@prisma/client";
import { formatThaiDate } from "@/lib/utils";
import { getPublicVillageProfile } from "@/features/public-village/server/public-village-profile";

interface PageProps {
  params: Promise<{ villageSlug: string }>;
}

/** Guest home: deliberately uses only village-managed public fields and public places. */
export default async function VillageHomePage({ params }: PageProps) {
  const { villageSlug: rawVillageSlug } = await params;
  const profile = await getPublicVillageProfile(rawVillageSlug);
  if (!profile) notFound();
  const { villageSlug, village, placeCounts } = profile;
  const catalog = village.catalogVillage;
  const villageName = `บ้าน${village.name}`;
  const locationLine = [village.subdistrict && `ตำบล${village.subdistrict}`, village.district && `อำเภอ${village.district}`, village.province && `จังหวัด${village.province}`].filter(Boolean).join(" ");
  const mapUrl = catalog?.latitude != null && catalog.longitude != null
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${catalog.latitude},${catalog.longitude}`)}`
    : null;
  const demographics = [
    { label: "ประชากรทั้งหมด", value: catalog?.populationTotal, icon: Users, tone: "bg-emerald-50 text-emerald-700" },
    { label: "จำนวนครัวเรือน", value: catalog?.householdCount, icon: Home, tone: "bg-sky-50 text-sky-700" },
    { label: "ประชากรชาย", value: catalog?.malePopulation, icon: Users, tone: "bg-amber-50 text-amber-700" },
    { label: "ประชากรหญิง", value: catalog?.femalePopulation, icon: Users, tone: "bg-rose-50 text-rose-700" },
  ].filter((stat): stat is typeof stat & { value: number } => stat.value != null);
  const services = [
    { category: VillagePlaceCategory.TEMPLE, label: "วัดและศาสนสถาน", icon: Compass, tone: "bg-emerald-50 text-emerald-700" },
    { category: VillagePlaceCategory.CLINIC, label: "โรงพยาบาล/คลินิก", icon: HeartPulse, tone: "bg-sky-50 text-sky-700" },
    { category: VillagePlaceCategory.SCHOOL, label: "สถานศึกษา", icon: School, tone: "bg-violet-50 text-violet-700" },
    { category: VillagePlaceCategory.GOVERNMENT, label: "หน่วยงานและบริการ", icon: Landmark, tone: "bg-amber-50 text-amber-700" },
    { category: VillagePlaceCategory.COMMUNITY, label: "สถานที่ชุมชน", icon: Users, tone: "bg-rose-50 text-rose-700" },
  ].filter((item) => item.category === VillagePlaceCategory.TEMPLE || item.category === VillagePlaceCategory.CLINIC || placeCounts.has(item.category));

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
          <h1 className="text-2xl font-bold sm:text-3xl">ยินดีต้อนรับสู่{villageName}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">ข่าวสาร กิจกรรม และช่องทางติดต่อที่หมู่บ้านเผยแพร่สู่สาธารณะ</p>
        </div>
      </section>

      <nav aria-label="ข้อมูลสาธารณะ" className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {links.map((item) => <Link key={item.href} href={item.href} className="group rounded-xl border border-gray-200 bg-white p-4 text-center transition hover:border-emerald-300 hover:shadow-md sm:p-5">
          <span className="mx-auto mb-2 inline-flex rounded-xl bg-emerald-50 p-2.5"><item.icon className="h-5 w-5 text-emerald-700" /></span>
          <span className="block text-sm font-semibold text-gray-700 group-hover:text-emerald-800">{item.label}</span>
        </Link>)}
      </nav>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900"><Info className="h-5 w-5 text-emerald-700" />ข้อมูลพื้นฐานหมู่บ้าน</h2>
        <p className="mt-3 text-lg font-semibold text-gray-900">{villageName}{village.moo ? ` หมู่ ${village.moo}` : ""}</p>
        {locationLine && <p className="mt-1 break-words text-sm text-gray-600">{locationLine}</p>}
        {demographics.length > 0 ? <><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {demographics.map((stat) => <div key={stat.label} className="min-w-0 rounded-xl border border-gray-100 bg-gray-50 p-3 sm:p-4">
            <span className={`mb-2 inline-flex rounded-lg p-2 ${stat.tone}`}><stat.icon className="h-4 w-4" /></span>
            <p className="text-xs font-medium text-gray-500">{stat.label}</p><p className="mt-1 text-xl font-bold text-gray-900">{stat.value.toLocaleString("th-TH")}</p>
          </div>)}
        </div>{(catalog?.sourceName || catalog?.sourceUpdatedAt) && <div className="mt-4 space-y-1 text-xs leading-5 text-gray-500">
          {catalog.sourceName && <p>แหล่งข้อมูล: {catalog.sourceUrl ? <a href={catalog.sourceUrl} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">{catalog.sourceName}</a> : catalog.sourceName}</p>}
          {catalog.sourceUpdatedAt && <p>อัปเดตข้อมูล: {formatThaiDate(catalog.sourceUpdatedAt)}</p>}
        </div>}</> : <p className="mt-4 text-sm text-gray-500">ยังไม่มีข้อมูลสถิติระดับหมู่บ้านจากแหล่งข้อมูลสาธารณะ</p>}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900"><MapPin className="h-5 w-5 text-emerald-700" />ที่ตั้งหมู่บ้าน</h2>
            <p className="mt-3 font-semibold text-gray-900">{villageName}{village.moo ? ` หมู่ ${village.moo}` : ""}</p>
            {locationLine && <p className="mt-1 break-words text-sm leading-6 text-gray-600">{locationLine}</p>}
            {mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-200 px-3 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50"><MapPin className="h-4 w-4" />ดูแผนที่<ExternalLink className="h-3.5 w-3.5" /></a>}
          </article>
          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="font-semibold text-gray-900">เกี่ยวกับหมู่บ้าน</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">{village.description || `ยินดีต้อนรับสู่${villageName} แหล่งข้อมูลและบริการออนไลน์สำหรับชุมชน`}</p>
          </article>
          <section>
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900"><Compass className="h-5 w-5 text-emerald-700" />สถานที่และบริการในชุมชน</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {services.length ? services.map((stat) => <div key={stat.label} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><span className={`rounded-xl p-2.5 ${stat.tone}`}><stat.icon className="h-5 w-5" /></span><div><p className="text-xs font-medium text-gray-500">{stat.label}</p><p className="mt-0.5 text-xl font-bold text-gray-900">{placeCounts.get(stat.category) ?? 0}</p></div></div>) : <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">ยังไม่มีข้อมูลสถานที่สาธารณะที่เผยแพร่</p>}
            </div>
          </section>
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
