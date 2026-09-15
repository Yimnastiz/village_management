import { ExternalLink, Info, MapPin, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { getPublicVillageProfile } from "@/features/public-village/server/public-village-profile";
import { formatThaiDate } from "@/lib/utils";

interface PageProps { params: Promise<{ villageSlug: string }> }

/** A shareable detailed profile; it uses the same aggregate-only public source as the home page. */
export default async function VillageInfoPage({ params }: PageProps) {
  const { villageSlug } = await params;
  const profile = await getPublicVillageProfile(villageSlug);
  if (!profile) notFound();

  const { village } = profile;
  const catalog = village.catalogVillage;
  const villageName = `บ้าน${village.name}`;
  const address = [village.subdistrict && `ตำบล${village.subdistrict}`, village.district && `อำเภอ${village.district}`, village.province && `จังหวัด${village.province}`].filter(Boolean).join(" ");
  const mapUrl = catalog?.latitude != null && catalog.longitude != null ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${catalog.latitude},${catalog.longitude}`)}` : null;
  const statistics = [["ประชากรทั้งหมด", catalog?.populationTotal], ["จำนวนครัวเรือน", catalog?.householdCount], ["ประชากรชาย", catalog?.malePopulation], ["ประชากรหญิง", catalog?.femalePopulation]].filter((item): item is [string, number] => item[1] != null);

  return <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
    <header className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7"><p className="text-sm font-medium text-emerald-700">ข้อมูลหมู่บ้าน</p><h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">{villageName}{village.moo ? ` หมู่ ${village.moo}` : ""}</h1>{address && <p className="mt-2 break-words text-sm leading-6 text-gray-600">{address}</p>}</header>
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="flex items-center gap-2 text-lg font-bold text-gray-900"><Users className="h-5 w-5 text-emerald-700" />ข้อมูลสถิติ</h2>{statistics.length ? <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{statistics.map(([label, value]) => <div key={label} className="rounded-xl bg-gray-50 p-3"><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-1 text-lg font-bold text-gray-900">{value.toLocaleString("th-TH")}</dd></div>)}</dl> : <p className="mt-3 text-sm text-gray-500">ยังไม่มีข้อมูลสถิติระดับหมู่บ้านจากแหล่งข้อมูลสาธารณะ</p>}{(catalog?.sourceName || catalog?.sourceUpdatedAt) && <div className="mt-4 text-xs leading-5 text-gray-500">{catalog.sourceName && <p>แหล่งข้อมูล: {catalog.sourceUrl ? <a href={catalog.sourceUrl} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">{catalog.sourceName}</a> : catalog.sourceName}</p>}{catalog.sourceUpdatedAt && <p>อัปเดตข้อมูล: {formatThaiDate(catalog.sourceUpdatedAt)}</p>}</div>}</section>
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="flex items-center gap-2 text-lg font-bold text-gray-900"><MapPin className="h-5 w-5 text-emerald-700" />ที่ตั้งหมู่บ้าน</h2><p className="mt-3 font-semibold text-gray-900">{villageName}{village.moo ? ` หมู่ ${village.moo}` : ""}</p>{address && <p className="mt-1 break-words text-sm text-gray-600">{address}</p>}{mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-200 px-3 text-sm font-medium text-emerald-800 hover:bg-emerald-50">ดูแผนที่ <ExternalLink className="h-3.5 w-3.5" /></a>}</section>
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="flex items-center gap-2 text-lg font-bold text-gray-900"><Info className="h-5 w-5 text-emerald-700" />เกี่ยวกับหมู่บ้าน</h2><p className="mt-3 text-sm leading-6 text-gray-600">{village.description || `ยินดีต้อนรับสู่${villageName} แหล่งข้อมูลและบริการออนไลน์สำหรับชุมชน`}</p></section>
  </div>;
}
