import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) throw new Error("Missing DATABASE_URL");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
async function main() {
  const [total, provinces, top, khaoSai, naiMueang] = await Promise.all([
    prisma.thailandVillageMaster.count(),
    prisma.thailandVillageMaster.groupBy({ by: ["province"], _count: { _all: true } }),
    prisma.thailandVillageMaster.groupBy({ by: ["province"], _count: { _all: true }, orderBy: { _count: { province: "desc" } }, take: 10 }),
    prisma.thailandVillageMaster.count({ where: { province: "พิจิตร", district: "ทับคล้อ", subdistrict: "เขาทราย" } }),
    prisma.thailandVillageMaster.count({ where: { province: "พิจิตร", district: "เมืองพิจิตร", subdistrict: "ในเมือง" } }),
  ]);
  console.log(JSON.stringify({ total, provinceCount: provinces.length, topProvinces: top.map((item) => ({ province: item.province, count: item._count._all })), sampleAreas: { "พิจิตร/ทับคล้อ/เขาทราย": khaoSai, "พิจิตร/เมืองพิจิตร/ในเมือง": naiMueang }, note: total === 0 ? "Catalog ยังไม่ถูก import: วาง JSON ดิบใน data/raw/gdcatalog-villages/ แล้วรัน npm run catalog:setup" : "Catalog พร้อมใช้งาน" }, null, 2));
}
main().catch((error) => { console.error(error.message || error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
