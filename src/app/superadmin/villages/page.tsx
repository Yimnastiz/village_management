import { QueryPagination } from "@/components/ui/query-pagination";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { CreateVillageForm, VillageCard } from "./village-management-client";

type PageProps = {
  searchParams?: Promise<{ q?: string; status?: string; province?: string; page?: string }>;
};

export default async function SuperAdminVillagesPage({ searchParams }: PageProps) {
  await requireSuperAdminPageSession();
  const params = (searchParams ? await searchParams : {}) ?? {};
  const keyword = (params.q ?? "").trim();
  const status = (params.status ?? "all").trim();
  const province = (params.province ?? "").trim();
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = 8;

  const where = {
    ...(status === "active" ? { isActive: true } : {}),
    ...(status === "inactive" ? { isActive: false } : {}),
    ...(province ? { province } : {}),
    ...(keyword
      ? {
          OR: [
            { name: { contains: keyword, mode: "insensitive" as const } },
            { slug: { contains: keyword, mode: "insensitive" as const } },
            { district: { contains: keyword, mode: "insensitive" as const } },
            { subdistrict: { contains: keyword, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [villages, totalCount, provinceRows] = await Promise.all([
    prisma.village.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: {
          select: {
            memberships: true,
            houses: true,
            news: true,
          },
        },
      },
    }),
    prisma.village.count({ where }),
    prisma.village.findMany({
      where: { province: { not: null } },
      distinct: ["province"],
      orderBy: { province: "asc" },
      select: { province: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const provinceOptions = provinceRows.map((row) => row.province).filter((row): row is string => Boolean(row));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">จัดการหมู่บ้าน</h1>
        <p className="mt-1 text-sm text-slate-600">สร้าง แก้ไข ปิดการใช้งาน และลบหมู่บ้านจากศูนย์กลาง</p>
      </div>

      <form method="GET" className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <input name="q" defaultValue={keyword} placeholder="ค้นหาชื่อหมู่บ้าน / slug / อำเภอ / ตำบล" className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
        <select name="status" defaultValue={status} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="all">ทุกสถานะ</option>
          <option value="active">เปิดใช้งาน</option>
          <option value="inactive">ปิดใช้งาน</option>
        </select>
        <select name="province" defaultValue={province} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">ทุกจังหวัด</option>
          {provinceOptions.map((provinceName) => (
            <option key={provinceName} value={provinceName}>{provinceName}</option>
          ))}
        </select>
        <div className="md:col-span-4 flex flex-wrap gap-2">
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">ค้นหา</button>
          <a href="/superadmin/villages" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">ล้างตัวกรอง</a>
        </div>
      </form>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">สร้างหมู่บ้านใหม่</h2>
        <CreateVillageForm />
      </section>

      <section className="space-y-3">
        {villages.map((village) => (
          <VillageCard
            key={village.id}
            village={{
              id: village.id,
              name: village.name,
              slug: village.slug,
              province: village.province,
              district: village.district,
              subdistrict: village.subdistrict,
              address: village.address,
              phone: village.phone,
              email: village.email,
              website: village.website,
              description: village.description,
              isActive: village.isActive,
              counts: {
                memberships: village._count.memberships,
                houses: village._count.houses,
                news: village._count.news,
              },
            }}
          />
        ))}
        {villages.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">ไม่พบหมู่บ้านตามตัวกรองที่เลือก</div> : null}
      </section>

      <QueryPagination pathname="/superadmin/villages" page={page} totalPages={totalPages} params={{ q: keyword || undefined, status: status !== "all" ? status : undefined, province: province || undefined }} />
    </div>
  );
}
