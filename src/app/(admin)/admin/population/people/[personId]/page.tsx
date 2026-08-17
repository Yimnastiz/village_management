import Link from "next/link";
import { MembershipStatus, MovementType, VillageMembershipRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { MEMBERSHIP_ROLE_LABELS, MEMBERSHIP_STATUS_LABELS, PERSON_STATUS_LABELS } from "@/lib/constants";
import { computeLandingPath, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { maskNationalId } from "@/lib/utils";
import { normalizePersonGender } from "@/lib/person-validation";
import { MoveOutPersonButton } from "../move-out-person-button";
import { MarkDeceasedPersonButton } from "../mark-deceased-person-button";

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

function maskLoginPhone(value: string) {
  if (value.length < 7) return value;
  return `${value.slice(0, 3)}-${"x".repeat(Math.max(3, value.length - 7))}-${value.slice(-4)}`;
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
      user: {
        select: {
          id: true, name: true, phoneNumber: true, email: true, accountStatus: true,
          memberships: { where: { villageId: adminMembership.villageId }, select: { role: true, status: true }, take: 1 },
        },
      },
    },
  });
  if (!person) redirect("/admin/population/people");

  const linkedMembership = person.user?.memberships[0] ?? null;
  const canRecordLifecycle = person.status === "ACTIVE" || person.status === "UNKNOWN";

  return <div data-admin-compact-top className="space-y-3 sm:space-y-4">
    <header className="space-y-3">
      <AdminPageToolbar
        variant="detail"
        backHref="/admin/population/people"
        backLabel="กลับทะเบียนประชากร"
        backPlacement="header-end"
        title={`${person.firstName} ${person.lastName}`}
        description="ข้อมูลทะเบียน ประวัติการอยู่อาศัย และบัญชีผู้ใช้ที่เชื่อมโยง"
        actions={<div className="flex flex-wrap gap-2"><Link href={`/admin/population/people/${person.id}/edit`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">แก้ไขข้อมูล</Link>{canRecordLifecycle ? <><MoveOutPersonButton personId={person.id} /><MarkDeceasedPersonButton personId={person.id} /></> : null}</div>}
      />
      {person.status === "MOVED_OUT" ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">บุคคลนี้ถูกย้ายออกจากทะเบียนแล้ว หากกลับมาอยู่ใหม่ ให้ดำเนินการผ่านการผูกเลขบ้านใหม่</p> : null}
      {person.status === "DECEASED" ? <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">บุคคลนี้ถูกบันทึกว่าเสียชีวิต ประวัติและบ้านที่บันทึกล่าสุดยังคงเก็บไว้ และไม่มีปุ่มเปลี่ยนกลับเป็นอยู่ในทะเบียนจากหน้านี้</p> : null}
    </header>

    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">{person.firstName} {person.lastName}</h2>
        <Badge variant={person.status === "ACTIVE" ? "success" : person.status === "MOVED_OUT" ? "warning" : "default"}>{PERSON_STATUS_LABELS[person.status] ?? person.status}</Badge>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="เลขบัตรประชาชน" value={person.nationalId ? maskNationalId(person.nationalId) : "-"} />
        <Detail label="วันเกิด" value={toThaiDate(person.dateOfBirth)} />
        <Detail label="เพศ" value={normalizePersonGender(person.gender) ?? "ไม่ระบุ"} />
        <Detail label="เบอร์โทรสำหรับติดต่อ" value={person.phone ?? "-"} />
        <Detail label="อีเมลสำหรับติดต่อ" value={person.email ?? "-"} className="break-all" />
        <div><dt className="text-gray-500">{person.status === "DECEASED" ? "บ้านที่บันทึกล่าสุด" : "บ้านปัจจุบัน"}</dt><dd className="mt-1 font-medium text-gray-900">{person.house ? <Link href={`/admin/population/houses/${person.house.id}`} className="text-blue-600 hover:text-blue-700 hover:underline">{person.house.houseNumber}</Link> : "-"}</dd></div>
      </dl>
    </section>

    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3"><h2 className="font-semibold text-gray-900">บัญชีผู้ใช้</h2></div>
      {!person.user ? <p className="px-4 py-8 text-sm text-gray-500">ยังไม่มีบัญชีผู้ใช้เชื่อมกับข้อมูลบุคคลนี้</p> : <div className="flex min-w-0 items-start gap-3 p-4 sm:items-center">
        <div aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700">{person.user.name.trim().slice(0, 1) || "ผ"}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900">{person.user.name}</p>
          <p className="mt-0.5 break-all text-sm text-gray-600">เบอร์เข้าสู่ระบบ {maskLoginPhone(person.user.phoneNumber)}</p>
          {person.user.email && !person.user.email.endsWith("@local.invalid") ? <p className="mt-0.5 break-all text-sm text-gray-600">อีเมลบัญชี {person.user.email}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
            {linkedMembership ? <><span>{MEMBERSHIP_ROLE_LABELS[linkedMembership.role] ?? linkedMembership.role}</span><span aria-hidden="true">·</span><Badge variant={linkedMembership.status === "ACTIVE" ? "success" : linkedMembership.status === "SUSPENDED" ? "warning" : "default"}>{MEMBERSHIP_STATUS_LABELS[linkedMembership.status] ?? linkedMembership.status}</Badge></> : <span>ไม่มี membership ของหมู่บ้านนี้ · สถานะบัญชี {person.user.accountStatus === "ACTIVE" ? "ใช้งานอยู่" : "ไม่พร้อมใช้งาน"}</span>}
          </div>
        </div>
      </div>}
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
