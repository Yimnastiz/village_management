import Link from "next/link";
import { MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MEMBERSHIP_ROLE_LABELS, MEMBERSHIP_STATUS_LABELS, OCCUPANCY_STATUS_LABELS, PERSON_STATUS_LABELS } from "@/lib/constants";
import { computeLandingPath, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

interface PageProps { params: Promise<{ houseId: string }> }
export default async function Page({ params }: PageProps) {
  const { houseId } = await params;

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

  const house = await prisma.house.findFirst({
    where: { id: houseId, villageId: membership.villageId },
    include: {
      zone: { select: { id: true, name: true } },
      persons: {
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          nationalId: true,
          phone: true,
          status: true,
          dateOfBirth: true,
        },
      },
      memberships: {
        where: { status: MembershipStatus.ACTIVE },
        include: {
          user: { select: { id: true, name: true, phoneNumber: true } },
        },
        orderBy: { role: "asc" },
      },
    },
  });
  if (!house) redirect("/admin/population/houses");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">บ้านเลขที่ {house.houseNumber}</h1>
          <p className="mt-1 text-sm text-gray-500">ดูข้อมูลบ้าน ประชากร และบัญชีผู้ใช้ที่ผูกอยู่</p>
        </div>
        <Link
          href="/admin/population/houses"
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          กลับไปทะเบียนบ้าน
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs text-gray-500">สถานะการอยู่อาศัย</p>
          <div className="mt-2">
            <Badge variant="outline">{OCCUPANCY_STATUS_LABELS[house.occupancyStatus]}</Badge>
          </div>
          <p className="mt-3 text-xs text-gray-500">โซน: {house.zone?.name ?? "-"}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs text-gray-500">จำนวนข้อมูลบุคคล</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{house.persons.length.toLocaleString("th-TH")}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs text-gray-500">บัญชีสมาชิกที่ผูกบ้าน</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{house.memberships.length.toLocaleString("th-TH")}</p>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="font-semibold text-gray-900">รายชื่อบุคคลในทะเบียนบ้าน</h2>
        </div>
        {house.persons.length === 0 ? (
          <p className="px-4 py-8 text-sm text-gray-500">ยังไม่มีข้อมูลบุคคลในทะเบียนบ้านนี้</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3">ชื่อ-นามสกุล</th>
                <th className="px-4 py-3">เลขบัตรประชาชน</th>
                <th className="px-4 py-3">ติดต่อ</th>
                <th className="px-4 py-3">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {house.persons.map((person) => (
                <tr key={person.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link href={`/admin/population/people/${person.id}`} className="hover:text-blue-700 hover:underline">
                      {person.firstName} {person.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{person.nationalId ?? "-"}</td>
                  <td className="px-4 py-3 text-gray-700">{person.phone ?? "-"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={person.status === "ACTIVE" ? "success" : "warning"}>
                      {PERSON_STATUS_LABELS[person.status]}
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
          <h2 className="font-semibold text-gray-900">บัญชีผู้ใช้ที่ผูกกับบ้านนี้</h2>
        </div>
        {house.memberships.length === 0 ? (
          <p className="px-4 py-8 text-sm text-gray-500">ยังไม่มีบัญชีผู้ใช้ที่ผูกกับบ้านหลังนี้</p>
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
              {house.memberships.map((item) => (
                <tr key={item.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.user.name}</td>
                  <td className="px-4 py-3 text-gray-700">{item.user.phoneNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{MEMBERSHIP_ROLE_LABELS[item.role] ?? item.role}</td>
                  <td className="px-4 py-3">
                    <Badge variant={item.status === "ACTIVE" ? "success" : "warning"}>{MEMBERSHIP_STATUS_LABELS[item.status] ?? item.status}</Badge>
                  </td>
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
