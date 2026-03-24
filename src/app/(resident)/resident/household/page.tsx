import Link from "next/link";
import { MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HouseholdPage() {
  const session = await getSessionContextFromServerCookies();

  if (!session) {
    redirect("/auth/login?callbackUrl=/resident/household");
  }

  const residentMembership = getResidentMembership(session);

  const primaryMembership = await prisma.villageMembership.findFirst({
    where: {
      userId: session.id,
      role: VillageMembershipRole.RESIDENT,
      status: MembershipStatus.ACTIVE,
    },
    orderBy: { updatedAt: "desc" },
    include: {
      village: {
        select: {
          id: true,
          name: true,
        },
      },
      house: {
        select: {
          id: true,
          houseNumber: true,
        },
      },
    },
  });

  const latestBindingRequest = await prisma.bindingRequest.findFirst({
    where: {
      userId: session.id,
    },
    orderBy: { createdAt: "desc" },
    include: {
      house: {
        select: {
          id: true,
          houseNumber: true,
        },
      },
      village: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const resolvedHouseId = primaryMembership?.houseId ?? latestBindingRequest?.houseId ?? null;
  const effectiveHouseId = residentMembership?.houseId ?? resolvedHouseId;
  const resolvedHouseNumber =
    primaryMembership?.house?.houseNumber ??
    latestBindingRequest?.house?.houseNumber ??
    latestBindingRequest?.houseNumber ??
    "-";
  const resolvedVillageName =
    primaryMembership?.village?.name ?? latestBindingRequest?.village?.name ?? "-";

  const [housePersons, houseMemberships] = effectiveHouseId
    ? await Promise.all([
        prisma.person.findMany({
          where: {
            houseId: effectiveHouseId,
          },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        }),
        prisma.villageMembership.findMany({
          where: {
            houseId: effectiveHouseId,
            status: MembershipStatus.ACTIVE,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                phoneNumber: true,
              },
            },
          },
          orderBy: { updatedAt: "desc" },
        }),
      ])
    : [[], []];

  const personEntries = housePersons.map((person) => ({
    key: `person-${person.id}`,
    name: `${person.firstName} ${person.lastName}`.trim(),
    phone: person.phone ?? "-",
    source: "ทะเบียนบุคคล",
  }));

  const membershipEntries = houseMemberships.map((membership) => ({
    key: `membership-${membership.id}`,
    name: membership.user.name,
    phone: membership.user.phoneNumber,
    source: "ผู้ใช้งานระบบ",
  }));

  const mergedMembers = [...personEntries, ...membershipEntries].reduce<
    Array<{ key: string; name: string; phone: string; source: string }>
  >((acc, member) => {
    const normalizedName = member.name.trim().toLowerCase();
    const normalizedPhone = member.phone.trim();
    const duplicate = acc.some(
      (item) =>
        item.name.trim().toLowerCase() === normalizedName &&
        item.phone.trim() === normalizedPhone
    );

    if (!duplicate) {
      acc.push(member);
    }
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">ข้อมูลครัวเรือน</h1>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          <div>
            <span className="text-gray-500">บ้านเลขที่:</span>{" "}
            <span className="font-medium text-gray-900">{resolvedHouseNumber}</span>
          </div>
          <div>
            <span className="text-gray-500">หมู่บ้าน:</span>{" "}
            <span className="font-medium text-gray-900">{resolvedVillageName}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">สมาชิกในบ้านเดียวกัน</h2>
        <p className="mt-1 text-sm text-gray-500">แสดงข้อมูลจากทะเบียนบุคคลและผู้ใช้งานระบบที่ผูกบ้านเดียวกัน</p>

        {mergedMembers.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">ยังไม่พบข้อมูลสมาชิกในบ้านนี้</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-600">
                  <th className="px-3 py-2">ชื่อ</th>
                  <th className="px-3 py-2">เบอร์โทร</th>
                  <th className="px-3 py-2">แหล่งข้อมูล</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {mergedMembers.map((member) => (
                  <tr key={member.key} className="border-b">
                    <td className="px-3 py-2 text-gray-900">{member.name || "-"}</td>
                    <td className="px-3 py-2 text-gray-700">{member.phone || "-"}</td>
                    <td className="px-3 py-2 text-gray-600">{member.source}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/resident/household/members/${member.key}`}
                        className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                      >
                        ดูรายละเอียด →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
