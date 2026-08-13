import Link from "next/link";
import { MembershipStatus, MovementType, VillageMembershipRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MEMBERSHIP_ROLE_LABELS, MEMBERSHIP_STATUS_LABELS, PERSON_STATUS_LABELS } from "@/lib/constants";
import { computeLandingPath, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { maskNationalId } from "@/lib/utils";
import { MoveOutPersonButton } from "../move-out-person-button";

interface PageProps { params: Promise<{ personId: string }> }

const MOVEMENT_LABELS: Record<MovementType, string> = {
  MOVE_IN: "ย้ายเข้า",
  MOVE_OUT: "ย้ายออก",
  BIRTH: "เกิด",
  DEATH: "เสียชีวิต",
  TRANSFER: "ย้ายทะเบียน",
};

function toThaiDate(value: Date | null): string {
  if (!value) return "-";
  return value.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

export default async function Page({ params }: PageProps) {
  const { personId } = await params;
  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/admin/population/people");
  if (!isAdminUser(session)) redirect(computeLandingPath(session));

  const adminMembership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: MembershipStatus.ACTIVE, role: { in: [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN, VillageMembershipRole.COMMITTEE] } },
    select: { villageId: true },
  });
  if (!adminMembership) redirect(computeLandingPath(session));

  const person = await prisma.person.findFirst({
    where: { id: personId, villageId: adminMembership.villageId },
    include: {
      house: { select: { id: true, houseNumber: true } },
      movements: { include: { house: { select: { houseNumber: true } } }, orderBy: { date: "desc" }, take: 10 },
    },
  });
  if (!person) redirect("/admin/population/people");

  const linkedMemberships = person.userId ? await prisma.villageMembership.findMany({
    where: { userId: person.userId, villageId: adminMembership.villageId },
    include: { user: { select: { name: true, phoneNumber: true } } },
    orderBy: { updatedAt: "desc" },
  }) : [];

  return <div className="space-y-5 sm:space-y-6">
    <header className="space-y-3">
      <Link href="/admin/population/people" className="inline-flex text-sm font-medium text-gray-600 hover:text-gray-900 hover:underline">← ทะเบียนประชากร</Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">รายละเอียดประชากร</h1>
          <p className="mt-1 text-sm text-gray-500">ข้อมูลทะเบียน ประวัติการอยู่อาศัย และบัญชีผู้ใช้ที่เชื่อมโยง</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/population/people/${person.id}/edit`}><Button variant="outline" className="min-h-11">แก้ไขข้อมูล</Button></Link>
          {person.status !== "MOVED_OUT" ? <MoveOutPersonButton personId={person.id} /> : null}
        </div>
      </div>
      {person.status === "MOVED_OUT" ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">บุคคลนี้ถูกย้ายออกจากทะเบียนแล้ว หากกลับมาอยู่ใหม่ ให้ดำเนินการผ่านการผูกเลขบ้านใหม่</p> : null}
    </header>

    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">{person.firstName} {person.lastName}</h2>
        <Badge variant={person.status === "ACTIVE" ? "success" : person.status === "MOVED_OUT" ? "warning" : "default"}>{PERSON_STATUS_LABELS[person.status] ?? person.status}</Badge>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="เลขบัตรประชาชน" value={person.nationalId ? maskNationalId(person.nationalId) : "-"} />
        <Detail label="วันเกิด" value={toThaiDate(person.dateOfBirth)} />
        <Detail label="เพศ" value={person.gender ?? "-"} />
        <Detail label="เบอร์โทร" value={person.phone ?? "-"} />
        <Detail label="อีเมล" value={person.email ?? "-"} className="break-all" />
        <div><dt className="text-gray-500">บ้านปัจจุบัน</dt><dd className="mt-1 font-medium text-gray-900">{person.house ? <Link href={`/admin/population/houses/${person.house.id}`} className="text-blue-600 hover:text-blue-700 hover:underline">{person.house.houseNumber}</Link> : "-"}</dd></div>
      </dl>
    </section>

    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3"><h2 className="font-semibold text-gray-900">บัญชีผู้ใช้ที่เชื่อมโยง</h2></div>
      {!person.userId ? <p className="px-4 py-8 text-sm text-gray-500">ยังไม่มีบัญชีผู้ใช้เชื่อมกับข้อมูลบุคคลนี้</p> : linkedMemberships.length === 0 ? <p className="px-4 py-8 text-sm text-gray-500">ไม่พบสถานะสมาชิกของบัญชีผู้ใช้นี้ในหมู่บ้าน</p> : <div className="overflow-x-auto"><table className="min-w-[620px] w-full text-sm"><thead className="bg-gray-50 text-left text-gray-600"><tr><th scope="col" className="px-4 py-3">ชื่อบัญชี</th><th scope="col" className="px-4 py-3">เบอร์ที่ใช้เข้าสู่ระบบ</th><th scope="col" className="px-4 py-3">บทบาท</th><th scope="col" className="px-4 py-3">สถานะสมาชิก</th></tr></thead><tbody>{linkedMemberships.map((membership) => <tr key={membership.id} className="border-t border-gray-100"><td className="px-4 py-3 font-medium text-gray-900">{membership.user.name}</td><td className="px-4 py-3 text-gray-700">{membership.user.phoneNumber}</td><td className="px-4 py-3 text-gray-700">{MEMBERSHIP_ROLE_LABELS[membership.role] ?? membership.role}</td><td className="px-4 py-3"><Badge variant={membership.status === "ACTIVE" ? "success" : membership.status === "SUSPENDED" ? "warning" : "default"}>{MEMBERSHIP_STATUS_LABELS[membership.status] ?? membership.status}</Badge></td></tr>)}</tbody></table></div>}
    </section>

    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3"><h2 className="font-semibold text-gray-900">ประวัติการย้ายล่าสุด</h2></div>
      {person.movements.length === 0 ? <p className="px-4 py-8 text-sm text-gray-500">ยังไม่มีประวัติการย้าย</p> : <div className="overflow-x-auto"><table className="min-w-[640px] w-full text-sm"><thead className="bg-gray-50 text-left text-gray-600"><tr><th scope="col" className="px-4 py-3">วันที่</th><th scope="col" className="px-4 py-3">ประเภท</th><th scope="col" className="px-4 py-3">บ้าน</th><th scope="col" className="px-4 py-3">หมายเหตุ</th></tr></thead><tbody>{person.movements.map((movement) => <tr key={movement.id} className="border-t border-gray-100"><td className="px-4 py-3 text-gray-700">{toThaiDate(movement.date)}</td><td className="px-4 py-3 text-gray-700">{MOVEMENT_LABELS[movement.movementType]}</td><td className="px-4 py-3 text-gray-700">{movement.house?.houseNumber ?? "-"}</td><td className="px-4 py-3 text-gray-700">{movement.note ?? "-"}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}

function Detail({ label, value, className }: { label: string; value: string; className?: string }) {
  return <div><dt className="text-gray-500">{label}</dt><dd className={`mt-1 font-medium text-gray-900 ${className ?? ""}`}>{value}</dd></div>;
}
