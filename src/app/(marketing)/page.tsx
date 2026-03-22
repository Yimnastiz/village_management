import Link from "next/link";
import { MapPin, Users, FileText, Siren } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getThaiGeographyHierarchy } from "@/lib/thai-geography";
import { VillagePublicSearch } from "./village-public-search";

export default async function HomePage() {
  const thaiGeography = getThaiGeographyHierarchy();

  const villages = await prisma.village.findMany({
    where: { isActive: true },
    orderBy: [{ province: "asc" }, { district: "asc" }, { subdistrict: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      province: true,
      district: true,
      subdistrict: true,
    },
  });

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-green-700 to-green-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            ระบบบริหารจัดการหมู่บ้านอัจฉริยะ
          </h1>
          <p className="text-lg text-green-100 mb-8 max-w-2xl mx-auto">
            เชื่อมต่อชุมชน บริหารหมู่บ้านอย่างมีประสิทธิภาพ โปร่งใส และทันสมัย
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/login"
              className="px-8 py-3 bg-white text-green-700 font-semibold rounded-xl hover:bg-green-50 transition-colors"
            >
              เข้าสู่ระบบ
            </Link>
            <Link
              href="/auth/register"
              className="px-8 py-3 border-2 border-white text-white font-semibold rounded-xl hover:bg-white/10 transition-colors"
            >
              สมัครสมาชิก
            </Link>
          </div>

          <VillagePublicSearch villages={villages} thaiGeography={thaiGeography} />
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-12">
            ฟีเจอร์หลักของระบบ
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: MapPin, title: "ข้อมูลหมู่บ้าน", desc: "เข้าถึงข้อมูลหมู่บ้าน ข่าวสาร และกิจกรรมต่างๆ" },
              { icon: Users, title: "ทะเบียนครัวเรือน", desc: "จัดการข้อมูลประชากรและครัวเรือนอย่างมีระบบ" },
              { icon: FileText, title: "ความโปร่งใส", desc: "เปิดเผยข้อมูลงบประมาณและโครงการหมู่บ้าน" },
              { icon: Siren, title: "แจ้งเหตุฉุกเฉิน", desc: "ระบบแจ้งเหตุฉุกเฉินและประกาศด่วน" },
            ].map((f, i) => (
              <div key={i} className="text-center p-6 rounded-xl border border-gray-100 hover:shadow-md transition-shadow">
                <div className="inline-flex p-3 bg-green-50 rounded-xl mb-4">
                  <f.icon className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">พร้อมใช้งานระบบแล้วหรือยัง?</h2>
          <p className="text-gray-500 mb-8">ค้นหาหมู่บ้านของคุณหรือสมัครเข้าใช้งานระบบวันนี้</p>
          <Link
            href="/auth/register"
            className="inline-block px-8 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors"
          >
            เริ่มต้นใช้งาน
          </Link>
        </div>
      </section>
    </div>
  );
}
