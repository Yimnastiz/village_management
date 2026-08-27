import Link from "next/link";
import { MembershipStatus, PersonStatus, VillageMembershipRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { normalizeHouseNumber } from "@/lib/house-number";
import { computeLandingPath, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { HouseBatchCreateDialog } from "@/features/population/components/house-batch-create-dialog";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";

type PageProps = { searchParams?: Promise<{ q?: string; occupancy?: string; sort?: string }> };

export default async function Page({ searchParams }: PageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};
  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/admin/population/houses");
  if (!isAdminUser(session)) redirect(computeLandingPath(session));
  const membership = await prisma.villageMembership.findFirst({ where: { userId: session.id, status: MembershipStatus.ACTIVE, role: { in: [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN] } }, select: { villageId: true } });
  if (!membership) redirect(computeLandingPath(session));

  const keyword = params.q?.trim() ?? "";
  const normalizedKeyword = normalizeHouseNumber(keyword);
  const occupancy = params.occupancy === "withPeople" || params.occupancy === "withoutPeople" ? params.occupancy : "all";
  const sort = params.sort === "desc" ? "desc" : "asc";
  const houses = await prisma.house.findMany({
    where: {
      villageId: membership.villageId,
      ...(keyword ? { OR: [{ houseNumber: { contains: keyword, mode: "insensitive" as const } }, { normalizedHouseNumber: { contains: normalizedKeyword, mode: "insensitive" as const } }] } : {}),
      ...(occupancy === "withPeople" ? { persons: { some: { status: PersonStatus.ACTIVE } } } : {}),
      ...(occupancy === "withoutPeople" ? { persons: { none: { status: PersonStatus.ACTIVE } } } : {}),
    },
    include: { _count: { select: { persons: { where: { status: PersonStatus.ACTIVE } }, memberships: { where: { status: MembershipStatus.ACTIVE } } } } },
    orderBy: [{ normalizedHouseNumber: sort }], take: 300,
  });
  const houseSuggestions = await prisma.house.findMany({
    where: { villageId: membership.villageId },
    select: { houseNumber: true },
    orderBy: [{ normalizedHouseNumber: "asc" }],
    take: 20,
  });

  function buildHref(next: { occupancy?: typeof occupancy; sort?: typeof sort }) {
    const query = new URLSearchParams();
    if (keyword) query.set("q", keyword);
    const nextOccupancy = next.occupancy ?? "all";
    const nextSort = next.sort ?? "asc";
    if (nextOccupancy !== "all") query.set("occupancy", nextOccupancy);
    if (nextSort !== "asc") query.set("sort", nextSort);
    const queryString = query.toString();
    return queryString ? `/admin/population/houses?${queryString}` : "/admin/population/houses";
  }

  return <div data-admin-compact-top className="flex min-h-0 flex-col gap-3 sm:h-[calc(100dvh-var(--app-topbar-visible-offset,4rem)-2rem)] sm:overflow-visible">
    <AdminListToolbar
      compact
      title="ทะเบียนบ้าน"
      description="ค้นหาเลขบ้านและเปิดดูรายละเอียดของแต่ละครัวเรือน"
      searchAction="/admin/population/houses"
      clearHref={buildHref({ occupancy: "all", sort: "asc" })}
      keyword={keyword}
      searchLabel="ค้นหาบ้านเลขที่"
      searchPlaceholder="ค้นหาเลขบ้าน เช่น 99/1"
      suggestionTitles={houseSuggestions.map((house) => house.houseNumber)}
      groups={[
        {
          label: "เรียง",
          options: [
            { label: "บ้านเลขที่น้อย → มาก", href: buildHref({ occupancy, sort: "asc" }), active: sort === "asc", isDefault: true },
            { label: "บ้านเลขที่มาก → น้อย", href: buildHref({ occupancy, sort: "desc" }), active: sort === "desc" },
          ],
        },
        {
          label: "สถานะข้อมูล",
          options: [
            { label: "ทั้งหมด", href: buildHref({ occupancy: "all", sort }), active: occupancy === "all", isDefault: true },
            { label: "มีประชากรปัจจุบัน", href: buildHref({ occupancy: "withPeople", sort }), active: occupancy === "withPeople" },
            { label: "ไม่มีประชากรปัจจุบัน", href: buildHref({ occupancy: "withoutPeople", sort }), active: occupancy === "withoutPeople" },
          ],
        },
      ]}
      actions={<HouseBatchCreateDialog />}
    />
    <section className={`-mx-4 flex min-h-[8rem] flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white sm:-mx-6 ${houses.length ? "" : "items-center justify-center"}`}>
      {houses.length ? <div className="min-h-0 flex-1 overflow-auto"><table className="min-w-[560px] w-full text-sm">
        <thead className="sticky top-0 z-20 bg-gray-50 text-left text-gray-600 shadow-sm"><tr><th scope="col" className="whitespace-nowrap bg-gray-50 px-4 py-3">บ้านเลขที่</th><th scope="col" className="whitespace-nowrap bg-gray-50 px-4 py-3">ประชากรปัจจุบัน</th><th scope="col" className="whitespace-nowrap bg-gray-50 px-4 py-3">สมาชิกที่ผูก</th><th scope="col" className="whitespace-nowrap bg-gray-50 px-4 py-3">การจัดการ</th></tr></thead>
        <tbody>{houses.map((house) => <tr key={house.id} className="group border-t border-gray-100 transition-colors hover:bg-blue-50/60 focus-within:bg-blue-50/60"><td className="break-words px-4 py-3 font-medium text-gray-900">{house.houseNumber}</td><td className="px-4 py-3 text-gray-700">{house._count.persons.toLocaleString("th-TH")} คน</td><td className="px-4 py-3 text-gray-700">{house._count.memberships.toLocaleString("th-TH")} บัญชี</td><td className="px-4 py-3"><Link href={`/admin/population/houses/${house.id}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">ดูรายละเอียด</Link></td></tr>)}</tbody>
      </table></div> : <div className="px-4 py-10 text-center text-sm text-gray-500">{keyword ? <><p className="font-medium text-gray-700">ไม่พบบ้านเลขที่ที่ตรงกับคำค้นหา</p><p className="mt-1">ลองตรวจสอบเลขบ้านหรือใช้คำค้นหาที่สั้นลง</p></> : <><p className="font-medium text-gray-700">ยังไม่มีข้อมูลทะเบียนบ้าน</p><p className="mt-1">เพิ่มบ้านเลขที่เพื่อเริ่มจัดทำทะเบียนครัวเรือน</p><div className="mt-4 flex justify-center"><HouseBatchCreateDialog /></div></>}</div>}
    </section>
  </div>;
}
