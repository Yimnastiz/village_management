import { QueryPagination } from "@/components/ui/query-pagination";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { getThaiGeographyHierarchy } from "@/lib/thai-geography";
import { CreateVillageForm, VillageCard, VillageSearchForm } from "./village-management-client";

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
  const thaiGeography = getThaiGeographyHierarchy();

  const where = {
    ...(status === "active" ? { isActive: true } : {}),
    ...(status === "inactive" ? { isActive: false } : {}),
    ...(province ? { province } : {}),
    ...(keyword
      ? {
          OR: [
            { name: { contains: keyword, mode: "insensitive" as const } },
            { slug: { contains: keyword, mode: "insensitive" as const } },
            { subdistrict: { contains: keyword, mode: "insensitive" as const } },
            { district: { contains: keyword, mode: "insensitive" as const } },
            { province: { contains: keyword, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [villages, totalCount] = await Promise.all([
    prisma.village.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { province: "asc" }, { district: "asc" }, { name: "asc" }],
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
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">จัดการหมู่บ้าน</h1>
        <p className="mt-1 text-sm text-slate-600">สร้าง แก้ไข ค้นหา และจัดการสถานะหมู่บ้านจากศูนย์กลาง</p>
      </div>

      <VillageSearchForm keyword={keyword} status={status} province={province} thaiGeography={thaiGeography} />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">สร้างหมู่บ้านใหม่</h2>
        <p className="mt-1 text-sm text-slate-500">เลือกจังหวัด อำเภอ และตำบลจากชุดข้อมูล GeoThai เพื่อป้องกันข้อมูลพื้นที่คลาดเคลื่อน</p>
        <CreateVillageForm thaiGeography={thaiGeography} />
      </section>

      <section className="space-y-3">
        {villages.map((village) => (
          <VillageCard
            key={village.id}
            thaiGeography={thaiGeography}
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
        {villages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-medium text-slate-700">ไม่พบหมู่บ้านตามตัวกรองที่เลือก</p>
            <p className="mt-1 text-xs text-slate-500">ลองค้นหาด้วยชื่อหมู่บ้าน slug ตำบล อำเภอ หรือจังหวัด</p>
          </div>
        ) : null}
      </section>

      <QueryPagination
        pathname="/superadmin/villages"
        page={page}
        totalPages={totalPages}
        params={{ q: keyword || undefined, status: status !== "all" ? status : undefined, province: province || undefined }}
      />
    </div>
  );
}

