import Link from "next/link";
import { MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { MEMBERSHIP_ROLE_LABELS, MEMBERSHIP_STATUS_LABELS, PERSON_STATUS_LABELS } from "@/lib/constants";
import { computeLandingPath, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

interface PageProps { params: Promise<{ personId: string }> }

function toThaiDate(value: Date | null): string {
  if (!value) return "-";
  return value.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function Page({ params }: PageProps) {
  const { personId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/admin/population/people");
  if (!isAdminUser(session)) redirect(computeLandingPath(session));

  const adminMembership = await prisma.villageMembership.findFirst({
    where: {
      userId: session.id,
      status: MembershipStatus.ACTIVE,
      role: {
        in: [
          VillageMembershipRole.HEADMAN,
          VillageMembershipRole.ASSISTANT_HEADMAN,
          VillageMembershipRole.COMMITTEE,
        ],
      },
    },
    select: { villageId: true },
  });
  if (!adminMembership) redirect(computeLandingPath(session));

  const person = await prisma.person.findFirst({
    where: {
      id: personId,
      villageId: adminMembership.villageId,
    },
    include: {
      house: {
        select: {
          id: true,
          houseNumber: true,
          address: true,
        },
      },
      movements: {
        include: {
          house: {
            select: {
              houseNumber: true,
            },
          },
        },
        orderBy: { date: "desc" },
        take: 10,
      },
    },
  });

  if (!person) {
    redirect("/admin/population/people");
  }

  const linkedMemberships = person.phone
    ? await prisma.villageMembership.findMany({
        where: {
          villageId: adminMembership.villageId,
          user: {
            phoneNumber: person.phone,
          },
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
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ข้อมูลบุคคล</h1>
          <p className="mt-1 text-sm text-gray-500">รายละเอียดข้อมูลทะเบียน ประวัติการย้าย และบัญชีผู้ใช้ที่เกี่ยวข้อง</p>
        </div>
        <Link
          href="/admin/population/people"
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          กลับไปหน้ารายการบุคคล
        </Link>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {person.firstName} {person.lastName}
            </h2>
            <p className="text-xs text-gray-500">รหัสบุคคล: {person.id}</p>
          </div>
          <Badge variant={person.status === "ACTIVE" ? "success" : "warning"}>
            {PERSON_STATUS_LABELS[person.status] ?? person.status}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-gray-500">เลขบัตรประชาชน</p>
            <p className="font-medium text-gray-900">{person.nationalId ?? "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">วันเกิด</p>
            <p className="font-medium text-gray-900">{toThaiDate(person.dateOfBirth)}</p>
          </div>
          <div>
            <p className="text-gray-500">เพศ</p>
            <p className="font-medium text-gray-900">{person.gender ?? "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">เบอร์โทร</p>
            <p className="font-medium text-gray-900">{person.phone ?? "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">อีเมล</p>
            <p className="font-medium text-gray-900 break-all">{person.email ?? "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">บ้านที่ผูก</p>
            {person.house ? (
              <Link href={`/admin/population/houses/${person.house.id}`} className="font-medium text-blue-600 hover:text-blue-700 hover:underline">
                {person.house.houseNumber}
              </Link>
            ) : (
              <p className="font-medium text-gray-900">-</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="font-semibold text-gray-900">บัญชีผู้ใช้ที่เชื่อมโยงจากเบอร์โทร</h2>
        </div>
        {linkedMemberships.length === 0 ? (
          <p className="px-4 py-8 text-sm text-gray-500">ไม่พบบัญชีผู้ใช้ที่เชื่อมกับเบอร์โทรนี้</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3">ผู้ใช้งาน</th>
                  <th className="px-4 py-3">เบอร์โทร</th>
                  <th className="px-4 py-3">บทบาท</th>
                  <th className="px-4 py-3">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {linkedMemberships.map((membership) => (
                  <tr key={membership.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{membership.user.name}</td>
                    <td className="px-4 py-3 text-gray-700">{membership.user.phoneNumber}</td>
                    <td className="px-4 py-3 text-gray-700">{MEMBERSHIP_ROLE_LABELS[membership.role] ?? membership.role}</td>
                    <td className="px-4 py-3">
                      <Badge variant={membership.status === "ACTIVE" ? "success" : "warning"}>
                        {MEMBERSHIP_STATUS_LABELS[membership.status] ?? membership.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="font-semibold text-gray-900">ประวัติการย้ายล่าสุด</h2>
        </div>
        {person.movements.length === 0 ? (
          <p className="px-4 py-8 text-sm text-gray-500">ยังไม่มีประวัติการย้าย</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3">วันที่</th>
                  <th className="px-4 py-3">ประเภท</th>
                  <th className="px-4 py-3">บ้าน</th>
                  <th className="px-4 py-3">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {person.movements.map((movement) => (
                  <tr key={movement.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-gray-700">{toThaiDate(movement.date)}</td>
                    <td className="px-4 py-3 text-gray-700">{movement.movementType}</td>
                    <td className="px-4 py-3 text-gray-700">{movement.house?.houseNumber ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-700">{movement.note ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
