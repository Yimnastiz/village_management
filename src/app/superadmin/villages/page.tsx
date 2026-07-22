import { Prisma } from "@prisma/client";
import { QueryPagination } from "@/components/ui/query-pagination";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { getThaiGeographyHierarchy } from "@/lib/thai-geography";
import { VillageCard, VillagesToolbar } from "./village-management-client";

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
  const hasSearch = keyword.length > 0;
  const geography = getThaiGeographyHierarchy();

  const where: Prisma.VillageWhereInput = hasSearch
    ? {
        ...(status === "active" ? { isActive: true } : {}),
        ...(status === "inactive" ? { isActive: false } : {}),
        ...(province ? { province } : {}),
        OR: [
          { name: { contains: keyword, mode: "insensitive" } },
          { slug: { contains: keyword, mode: "insensitive" } },
          { subdistrict: { contains: keyword, mode: "insensitive" } },
          { district: { contains: keyword, mode: "insensitive" } },
          { province: { contains: keyword, mode: "insensitive" } },
        ],
      }
    : {};

  const [villages, totalCount] = hasSearch
    ? await Promise.all([
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
      ])
    : [[], 0];

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6">
      <VillagesToolbar
        geography={geography}
        initialQuery={keyword}
        initialStatus={status}
        initialProvince={province}
      />

      <section className="space-y-3">
        {!hasSearch ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
            <h2 className="text-base font-semibold text-slate-900">ค้นหาหมู่บ้านเพื่อเริ่มจัดการ</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
              พิมพ์ชื่อหมู่บ้าน ตำบล อำเภอ หรือจังหวัด เพื่อค้นหาหมู่บ้านที่ต้องการจัดการ
            </p>
          </div>
        ) : null}

        {hasSearch && villages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
            <h2 className="text-base font-semibold text-slate-900">ไม่พบหมู่บ้านที่ตรงกับคำค้นหา</h2>
            <p className="mt-2 text-sm text-slate-500">ลองเปลี่ยนคำค้นหา หรือเพิ่มหมู่บ้านใหม่จากปุ่มด้านบน</p>
          </div>
        ) : null}

        {villages.map((village) => (
          <VillageCard
            key={village.id}
            geography={geography}
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
      </section>

      {hasSearch ? (
        <QueryPagination
          pathname="/superadmin/villages"
          page={page}
          totalPages={totalPages}
          params={{
            q: keyword,
            status: status !== "all" ? status : undefined,
            province: province || undefined,
          }}
        />
      ) : null}
    </div>
  );
}
