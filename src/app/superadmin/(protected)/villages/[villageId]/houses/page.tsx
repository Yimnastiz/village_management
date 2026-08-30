import Link from "next/link";
import { MembershipStatus, PersonStatus } from "@prisma/client";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { QueryPagination } from "@/components/ui/query-pagination";
import { HouseBatchCreateDialog } from "@/features/population/components/house-batch-create-dialog";
import { getWorkspaceVillage } from "@/features/village-workspace/server/queries";
import { normalizeHouseNumber } from "@/lib/house-number";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { createSuperAdminHousesAction } from "../population-actions";

type PageProps = { params: Promise<{ villageId: string }>; searchParams: Promise<{ q?: string; occupancy?: string; sort?: string; page?: string }> };

export default async function Page({ params, searchParams }: PageProps) {
  await requireSuperAdminPageSession();
  const { villageId } = await params;
  const search = await searchParams;
  const village = await getWorkspaceVillage(villageId);
  const keyword = search.q?.trim() ?? "";
  const normalizedKeyword = normalizeHouseNumber(keyword);
  const occupancy = search.occupancy === "withPeople" || search.occupancy === "withoutPeople" ? search.occupancy : "all";
  const sort = search.sort === "desc" ? "desc" : "asc";
  const page = Math.max(1, Number(search.page ?? "1") || 1);
  const pageSize = 25;
  const base = `/superadmin/villages/${villageId}/houses`;
  const where = {
    villageId,
    ...(keyword ? { OR: [{ houseNumber: { contains: keyword, mode: "insensitive" as const } }, { normalizedHouseNumber: { contains: normalizedKeyword, mode: "insensitive" as const } }] } : {}),
    ...(occupancy === "withPeople" ? { persons: { some: { status: PersonStatus.ACTIVE } } } : {}),
    ...(occupancy === "withoutPeople" ? { persons: { none: { status: PersonStatus.ACTIVE } } } : {}),
  };
  const [houses, total, houseSuggestions] = await Promise.all([
    prisma.house.findMany({ where, include: { _count: { select: { persons: { where: { status: PersonStatus.ACTIVE } }, memberships: { where: { status: MembershipStatus.ACTIVE } } } } }, orderBy: [{ normalizedHouseNumber: sort }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.house.count({ where }),
    prisma.house.findMany({ where: { villageId }, select: { houseNumber: true }, orderBy: [{ normalizedHouseNumber: "asc" }], take: 20 }),
  ]);
  const buildHref = (next: { occupancy?: typeof occupancy; sort?: typeof sort }) => {
    const query = new URLSearchParams();
    if (keyword) query.set("q", keyword);
    const nextOccupancy = next.occupancy ?? "all";
    const nextSort = next.sort ?? "asc";
    if (nextOccupancy !== "all") query.set("occupancy", nextOccupancy);
    if (nextSort !== "asc") query.set("sort", nextSort);
    const queryString = query.toString();
    return queryString ? `${base}?${queryString}` : base;
  };

  return <div className="flex min-h-0 flex-col sm:h-[calc(100dvh-var(--app-topbar-visible-offset,4rem)-2rem)] sm:overflow-visible">
    <SuperAdminPageHeaderRegistration priority={1} context={{ title: "ทะเบียนบ้าน", description: `จัดการบ้านเฉพาะ ${village.name} · ${total.toLocaleString("th-TH")} หลัง` }} />
    <AdminListToolbar sticky hideHeading title="ทะเบียนบ้าน" description={`จัดการบ้านเฉพาะ ${village.name} · ${total.toLocaleString("th-TH")} หลัง`} searchAction={base} clearHref={buildHref({ occupancy: "all", sort: "asc" })} keyword={keyword} searchLabel="ค้นหาบ้านเลขที่" searchPlaceholder="ค้นหาบ้านเลขที่ เช่น 99/1" suggestionTitles={houseSuggestions.map((house) => house.houseNumber)} groups={[
      { label: "เรียง", options: [{ label: "บ้านเลขที่น้อย → มาก", href: buildHref({ occupancy, sort: "asc" }), active: sort === "asc", isDefault: true }, { label: "บ้านเลขที่มาก → น้อย", href: buildHref({ occupancy, sort: "desc" }), active: sort === "desc" }] },
      { label: "สถานะข้อมูล", options: [{ label: "ทั้งหมด", href: buildHref({ occupancy: "all", sort }), active: occupancy === "all", isDefault: true }, { label: "มีประชากรปัจจุบัน", href: buildHref({ occupancy: "withPeople", sort }), active: occupancy === "withPeople" }, { label: "ไม่มีประชากรปัจจุบัน", href: buildHref({ occupancy: "withoutPeople", sort }), active: occupancy === "withoutPeople" }] },
    ]} actions={<HouseBatchCreateDialog createAction={createSuperAdminHousesAction.bind(null, villageId)} requireReason />} />
    <section className={`mt-2 flex min-h-[8rem] flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white ${houses.length ? "" : "items-center justify-center"}`}>
      {houses.length ? <div className="min-h-0 flex-1 overflow-auto"><table className="min-w-[600px] w-full text-sm">
        <thead className="sticky top-0 z-20 bg-gray-50 text-left text-gray-600 shadow-sm"><tr><th scope="col" className="whitespace-nowrap bg-gray-50 px-4 py-3">บ้านเลขที่</th><th scope="col" className="whitespace-nowrap bg-gray-50 px-4 py-3">ประชากรปัจจุบัน</th><th scope="col" className="whitespace-nowrap bg-gray-50 px-4 py-3">สมาชิกที่ผูก</th><th scope="col" className="whitespace-nowrap bg-gray-50 px-4 py-3">การจัดการ</th></tr></thead>
        <tbody>{houses.map((house) => <tr key={house.id} className="group border-t border-gray-100 transition-colors hover:bg-blue-50/60 focus-within:bg-blue-50/60"><td className="break-words px-4 py-3 font-medium text-gray-900">{house.houseNumber}{house.address ? <p className="mt-0.5 text-xs font-normal text-gray-500">{house.address}</p> : null}</td><td className="px-4 py-3 text-gray-700">{house._count.persons.toLocaleString("th-TH")} คน</td><td className="px-4 py-3 text-gray-700">{house._count.memberships.toLocaleString("th-TH")} บัญชี</td><td className="px-4 py-3"><Link href={`${base}/${house.id}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2">ดูรายละเอียด</Link></td></tr>)}</tbody>
      </table></div> : <div className="px-4 py-10 text-center text-sm text-gray-500">{keyword ? <><p className="font-medium text-gray-700">ไม่พบบ้านเลขที่ที่ตรงกับคำค้นหา</p><p className="mt-1">ลองตรวจสอบเลขบ้านหรือใช้คำค้นหาที่สั้นลง</p></> : <><p className="font-medium text-gray-700">ยังไม่มีข้อมูลทะเบียนบ้าน</p><p className="mt-1">เพิ่มบ้านเลขที่เพื่อเริ่มจัดทำทะเบียนครัวเรือน</p><div className="mt-4 flex justify-center"><HouseBatchCreateDialog createAction={createSuperAdminHousesAction.bind(null, villageId)} requireReason /></div></>}</div>}
    </section>
    <QueryPagination pathname={base} page={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} params={{ q: keyword || undefined, occupancy: occupancy === "all" ? undefined : occupancy, sort: sort === "asc" ? undefined : sort }} />
  </div>;
}
