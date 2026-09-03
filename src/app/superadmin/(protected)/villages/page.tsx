import { Prisma } from "@prisma/client";
import { QueryPagination } from "@/components/ui/query-pagination";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { getThaiGeographyHierarchy } from "@/lib/thai-geography";
import { VillageCard, VillagesToolbar } from "./village-management-client";

type AttentionFilter = "pending-bindings" | "open-issues" | "pending-appointments" | "missing-headman";
type PageProps = { searchParams?: Promise<{ searched?: string; q?: string; status?: string; province?: string; attention?: string; page?: string }> };

export default async function SuperAdminVillagesPage({ searchParams }: PageProps) {
  await requireSuperAdminPageSession();
  const params = (searchParams ? await searchParams : {}) ?? {};
  const hasSearched = params.searched === "1";
  const keyword = (params.q ?? "").trim();
  const status = (params.status ?? "all").trim();
  const province = (params.province ?? "").trim();
  const attention = (params.attention ?? "").trim() as AttentionFilter | "";
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = 8;
  const geography = getThaiGeographyHierarchy();
  const where: Prisma.VillageWhereInput = {
    ...(status === "active" ? { isActive: true } : {}),
    ...(status === "inactive" ? { isActive: false } : {}),
    ...(province ? { province } : {}),
    ...(attention === "pending-bindings" ? { bindingRequests: { some: { status: "PENDING" } } } : {}),
    ...(attention === "open-issues" ? { issues: { some: { stage: { in: ["OPEN", "IN_PROGRESS", "WAITING"] } } } } : {}),
    ...(attention === "pending-appointments" ? { appointments: { some: { stage: { in: ["PENDING_APPROVAL", "TIME_SUGGESTED"] } } } } : {}),
    ...(attention === "missing-headman" ? { memberships: { none: { role: "HEADMAN", status: "ACTIVE" } } } : {}),
    ...(keyword ? {
      OR: [
        { name: { contains: keyword, mode: "insensitive" } },
        { slug: { contains: keyword, mode: "insensitive" } },
        { subdistrict: { contains: keyword, mode: "insensitive" } },
        { district: { contains: keyword, mode: "insensitive" } },
        { province: { contains: keyword, mode: "insensitive" } },
      ],
    } : {}),
  };
  const [villages, totalCount] = hasSearched
    ? await Promise.all([
        prisma.village.findMany({ where, orderBy: [{ createdAt: "desc" }, { updatedAt: "desc" }], skip: (page - 1) * pageSize, take: pageSize, include: { _count: { select: { memberships: true, houses: true, news: true } } } }),
        prisma.village.count({ where }),
      ])
    : [[], 0];
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="workspace-list-page -mt-4 mx-auto w-full max-w-[1500px] space-y-4 sm:-mt-6">
      <VillagesToolbar geography={geography} initialQuery={keyword} initialStatus={status} initialProvince={province} initialAttention={attention} />
      <section className="space-y-3">
        {!hasSearched ? <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center"><h2 className="text-base font-semibold text-slate-900">ยังไม่ได้ค้นหา</h2><p className="mt-2 text-sm text-slate-500">กรอกคำค้นหา เลือกตัวกรอง หรือกดค้นหาเพื่อแสดงข้อมูลหมู่บ้าน</p></div> : null}
        {hasSearched && villages.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center"><h2 className="text-base font-semibold text-slate-900">ไม่พบหมู่บ้านที่ตรงกับเงื่อนไข</h2><p className="mt-2 text-sm text-slate-500">ลองปรับคำค้นหาหรือตัวกรอง แล้วค้นหาอีกครั้ง</p></div> : null}
        {villages.map((village) => <VillageCard key={village.id} geography={geography} village={{ id: village.id, name: village.name, moo: village.moo, slug: village.slug, province: village.province, district: village.district, subdistrict: village.subdistrict, address: village.address, phone: village.phone, email: village.email, website: village.website, description: village.description, isActive: village.isActive, sourceNote: village.sourceNote, catalogVillageId: village.catalogVillageId, counts: { memberships: village._count.memberships, houses: village._count.houses, news: village._count.news } }} />)}
      </section>
      {hasSearched ? <QueryPagination pathname="/superadmin/villages" page={page} totalPages={totalPages} params={{ searched: "1", q: keyword || undefined, status: status !== "all" ? status : undefined, province: province || undefined, attention: attention || undefined }} /> : null}
    </div>
  );
}
