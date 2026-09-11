import Link from "next/link";
import { ConfiguredVillageError, getConfiguredVillage, type ConfiguredVillage } from "@/lib/configured-village";

function ConfigurationErrorPage() {
  return <main className="mx-auto max-w-xl px-4 py-20"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-semibold text-amber-950">ระบบยังไม่พร้อมใช้งาน</h1><p className="mt-2 text-sm leading-6 text-amber-900">กรุณาติดต่อผู้ดูแลระบบเพื่อตรวจสอบการตั้งค่าหมู่บ้าน</p></div></main>;
}

function VillageHomePage({ village }: { village: ConfiguredVillage }) {
  const location = [village.subdistrict, village.district, village.province].filter(Boolean).join(" · ");
  return <main className="bg-gradient-to-br from-green-800 to-green-950 px-4 py-20 text-white sm:py-28">
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-sm font-medium text-green-200">Village Management System</p>
      <h1 className="mt-3 text-4xl font-bold sm:text-5xl">{village.name}{village.moo ? ` หมู่ ${village.moo}` : ""}</h1>
      {location ? <p className="mt-4 text-green-100">{location}</p> : null}
      <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-green-100">ข่าวสาร บริการ และพื้นที่ทำงานของหมู่บ้านนี้อยู่ในที่เดียว</p>
      <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href={`/${village.slug}`} className="rounded-xl bg-white px-6 py-3 font-semibold text-green-800 hover:bg-green-50">ดูข้อมูลหมู่บ้าน</Link>
        <Link href="/auth/login" className="rounded-xl border border-white/70 px-6 py-3 font-semibold hover:bg-white/10">เข้าสู่ระบบ</Link>
        <Link href="/auth/register" className="rounded-xl border border-white/70 px-6 py-3 font-semibold hover:bg-white/10">สมัครสมาชิก</Link>
      </div>
    </div>
  </main>;
}

export default async function HomePage() {
  let village: ConfiguredVillage | null = null;
  try {
    village = await getConfiguredVillage();
  } catch (error) {
    if (!(error instanceof ConfiguredVillageError)) throw error;
  }

  return village ? <VillageHomePage village={village} /> : <ConfigurationErrorPage />;
}
