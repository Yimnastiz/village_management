import { HouseholdOccupancyStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { getWorkspaceVillage } from "@/features/village-workspace/server/queries";
import { WorkspaceListPage } from "../workspace-list";

export default async function Page({ params, searchParams }: { params: Promise<{ villageId: string }>; searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireSuperAdminPageSession();
  const { villageId } = await params;
  const search = await searchParams;
  const village = await getWorkspaceVillage(villageId);
  const where: Prisma.HouseWhereInput = {
    villageId,
    ...(search.q ? { OR: [{ houseNumber: { contains: search.q, mode: "insensitive" } }, { address: { contains: search.q, mode: "insensitive" } }] } : {}),
    ...(search.status && search.status !== "ALL" ? { occupancyStatus: search.status as HouseholdOccupancyStatus } : {}),
  };
  const rows = await prisma.house.findMany({
    where,
    orderBy: { houseNumber: "asc" },
    take: 200,
    include: { _count: { select: { persons: { where: { villageId } }, memberships: { where: { villageId } } } } },
  });
  const base = `/superadmin/villages/${villageId}/houses`;
  return <WorkspaceListPage title="บ้าน" description={`ทะเบียนบ้านเฉพาะ ${village.name} · ${rows.length} รายการ`} basePath={base} query={search.q ?? ""} status={search.status ?? "ALL"} statuses={[{ value: "OCCUPIED", label: "มีผู้อยู่อาศัย" }, { value: "VACANT", label: "ว่าง" }, { value: "UNKNOWN", label: "ไม่ทราบสถานะ" }]} items={rows.map((row) => ({ id: row.id, title: `บ้านเลขที่ ${row.houseNumber}`, description: row.address, status: row.occupancyStatus, meta: `ประชากร ${row._count.persons} คน · สมาชิกระบบ ${row._count.memberships} คน` }))} emptyText="ไม่พบข้อมูลบ้าน" />;
}
