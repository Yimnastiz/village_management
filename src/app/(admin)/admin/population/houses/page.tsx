import Link from "next/link";
import { MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { OCCUPANCY_STATUS_LABELS } from "@/lib/constants";
import { computeLandingPath, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { createHouseAction } from "./actions";

type PageProps = {
  searchParams?: Promise<{ q?: string; occupancy?: string }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};
  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/admin/population/houses");
  if (!isAdminUser(session)) redirect(computeLandingPath(session));

  const membership = await prisma.villageMembership.findFirst({
    where: {
      userId: session.id,
      status: MembershipStatus.ACTIVE,
      role: { in: [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN, VillageMembershipRole.COMMITTEE] },
    },
    select: { villageId: true },
  });
  if (!membership) redirect(computeLandingPath(session));

  const keyword = params.q?.trim() ?? "";
  const activeOccupancy = params.occupancy ?? "ALL";

  const houses = await prisma.house.findMany({
    where: {
      villageId: membership.villageId,
      ...(keyword ? { OR: [{ houseNumber: { contains: keyword, mode: "insensitive" as const } }, { normalizedHouseNumber: { contains: keyword.replace(/\s+/g, ""), mode: "insensitive" as const } }] } : {}),
      ...(activeOccupancy !== "ALL" ? { occupancyStatus: activeOccupancy as "OCCUPIED" | "VACANT" | "UNDER_CONSTRUCTION" | "DEMOLISHED" } : {}),
    },
    include: {
      zone: { select: { name: true } },
      _count: { select: { persons: true, memberships: true } },
    },
    orderBy: [{ houseNumber: "asc" }],
    take: 300,
  });

  const suggestionTitles = houses.map((house) => house.houseNumber).slice(0, 12);

  function buildHousesHref(next: { q?: string; occupancy?: string }) {
    const query = new URLSearchParams();
    const q = next.q?.trim() ?? "";
    const occupancy = next.occupancy ?? "ALL";
    if (q) query.set("q", q);
    if (occupancy !== "ALL") query.set("occupancy", occupancy);
    const queryString = query.toString();
    return queryString ? `/admin/population/houses?${queryString}` : "/admin/population/houses";
  }

  return (
    <div className="space-y-6">
      <AdminListToolbar
        title="ทะเบียนบ้าน"
        description="ค้นหาเลขบ้านและเปิดดูรายละเอียดของแต่ละครัวเรือน"
        searchAction="/admin/population/houses"
        keyword={keyword}
        searchPlaceholder="ค้นหาเลขบ้าน เช่น 99/1"
        hiddenInputs={{ occupancy: activeOccupancy === "ALL" ? "" : activeOccupancy }}
        suggestionTitles={suggestionTitles}
        groups={[
          {
            label: "สถานะการอยู่อาศัย",
            options: [
              { label: "ทั้งหมด", href: buildHousesHref({ q: keyword, occupancy: "ALL" }), active: activeOccupancy === "ALL" },
              { label: "มีผู้อยู่อาศัย", href: buildHousesHref({ q: keyword, occupancy: "OCCUPIED" }), active: activeOccupancy === "OCCUPIED" },
              { label: "ว่าง", href: buildHousesHref({ q: keyword, occupancy: "VACANT" }), active: activeOccupancy === "VACANT" },
              { label: "ก่อสร้าง", href: buildHousesHref({ q: keyword, occupancy: "UNDER_CONSTRUCTION" }), active: activeOccupancy === "UNDER_CONSTRUCTION" },
              { label: "รื้อถอน", href: buildHousesHref({ q: keyword, occupancy: "DEMOLISHED" }), active: activeOccupancy === "DEMOLISHED" },
            ],
          },
        ]}
      />

      <form action={createHouseAction} className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-[1fr_1fr_auto_auto]">
        <input name="houseNumber" required maxLength={50} placeholder="เพิ่มบ้าน เช่น 96/4" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <input name="address" placeholder="ที่อยู่เพิ่มเติม (ถ้ามี)" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <select name="occupancyStatus" className="rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="OCCUPIED">มีผู้อยู่อาศัย</option><option value="VACANT">ว่าง</option><option value="UNDER_CONSTRUCTION">กำลังก่อสร้าง</option></select>
        <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white">เพิ่มบ้าน</button>
      </form>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3">บ้านเลขที่</th>
              <th className="px-4 py-3">โซน</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3">จำนวนคน</th>
              <th className="px-4 py-3">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {houses.map((house) => (
              <tr key={house.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium text-gray-900">{house.houseNumber}</td>
                <td className="px-4 py-3 text-gray-700">{house.zone?.name ?? "-"}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{OCCUPANCY_STATUS_LABELS[house.occupancyStatus]}</Badge>
                </td>
                <td className="px-4 py-3 text-gray-700">{house._count.persons.toLocaleString("th-TH")} คน</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/population/houses/${house.id}`}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    ดูรายละเอียด
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {houses.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-gray-500">ไม่พบบ้านตามเงื่อนไขที่ค้นหา</div>
        )}
      </div>
    </div>
  );
}
