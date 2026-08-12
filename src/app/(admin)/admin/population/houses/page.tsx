import Link from "next/link";
import { MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { computeLandingPath, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { HouseForm } from "@/features/population/components/house-form";
import { createHouseAction } from "./actions";

type PageProps = { searchParams?: Promise<{ q?: string }> };

export default async function Page({ searchParams }: PageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};
  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/admin/population/houses");
  if (!isAdminUser(session)) redirect(computeLandingPath(session));

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: MembershipStatus.ACTIVE, role: { in: [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN, VillageMembershipRole.COMMITTEE] } },
    select: { villageId: true },
  });
  if (!membership) redirect(computeLandingPath(session));

  const keyword = params.q?.trim() ?? "";
  const houses = await prisma.house.findMany({
    where: {
      villageId: membership.villageId,
      ...(keyword ? { OR: [{ houseNumber: { contains: keyword, mode: "insensitive" as const } }, { normalizedHouseNumber: { contains: keyword.replace(/\s+/g, ""), mode: "insensitive" as const } }] } : {}),
    },
    include: { _count: { select: { persons: true, memberships: true } } },
    orderBy: [{ houseNumber: "asc" }],
    take: 300,
  });

  return <div className="space-y-6">
    <AdminListToolbar
      title="ทะเบียนบ้าน"
      description="ค้นหาเลขบ้านและเปิดดูรายละเอียดของแต่ละครัวเรือน"
      searchAction="/admin/population/houses"
      keyword={keyword}
      searchPlaceholder="ค้นหาเลขบ้าน เช่น 99/1"
      suggestionTitles={houses.map((house) => house.houseNumber).slice(0, 12)}
    />

    <HouseForm action={createHouseAction} showReason={false} />

    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto"><table className="min-w-[560px] w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-600"><tr><th className="px-4 py-3">บ้านเลขที่</th><th className="px-4 py-3">จำนวนคน</th><th className="px-4 py-3">สมาชิกที่ผูก</th><th className="px-4 py-3">การจัดการ</th></tr></thead>
        <tbody>{houses.map((house) => <tr key={house.id} className="border-t border-gray-100">
          <td className="break-words px-4 py-3 font-medium text-gray-900">{house.houseNumber}</td>
          <td className="px-4 py-3 text-gray-700">{house._count.persons.toLocaleString("th-TH")} คน</td>
          <td className="px-4 py-3 text-gray-700">{house._count.memberships.toLocaleString("th-TH")} บัญชี</td>
          <td className="px-4 py-3"><Link href={`/admin/population/houses/${house.id}`} className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">ดูรายละเอียด</Link></td>
        </tr>)}</tbody>
      </table></div>
      {!houses.length ? <div className="px-4 py-10 text-center text-sm text-gray-500">
        {keyword ? "ไม่พบบ้านตามเงื่อนไขที่ค้นหา" : <><p className="font-medium text-gray-700">ยังไม่มีข้อมูลทะเบียนบ้าน</p><p className="mt-1">เพิ่มบ้านเลขที่เพื่อเริ่มจัดทำทะเบียนครัวเรือน</p></>}
      </div> : null}
    </div>
  </div>;
}
