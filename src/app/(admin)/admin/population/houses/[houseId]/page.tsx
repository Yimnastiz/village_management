import Link from "next/link";
import { MembershipStatus, PersonStatus, VillageMembershipRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { MEMBERSHIP_ROLE_LABELS, MEMBERSHIP_STATUS_LABELS, PERSON_STATUS_LABELS } from "@/lib/constants";
import { computeLandingPath, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { maskNationalId } from "@/lib/utils";
import { DeleteHouseButton } from "../delete-house-button";

export default async function Page({ params, searchParams }: { params: Promise<{ houseId: string }>; searchParams?: Promise<{ history?: string }> }) {
  const { houseId } = await params;
  const historyEnabled = (await searchParams)?.history === "1";
  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/admin/population/houses");
  if (!isAdminUser(session)) redirect(computeLandingPath(session));
  const membership = await prisma.villageMembership.findFirst({ where: { userId: session.id, status: MembershipStatus.ACTIVE, role: { in: [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN] } }, select: { villageId: true } });
  if (!membership) redirect(computeLandingPath(session));

  const house = await prisma.house.findFirst({
    where: { id: houseId, villageId: membership.villageId },
    include: {
      persons: {
        where: historyEnabled
          ? { status: { in: [PersonStatus.ACTIVE, PersonStatus.MOVED_OUT, PersonStatus.DECEASED] } }
          : { status: PersonStatus.ACTIVE },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: { id: true, firstName: true, lastName: true, nationalId: true, phone: true, status: true },
      },
      memberships: { where: { status: MembershipStatus.ACTIVE }, include: { user: { select: { id: true, name: true, phoneNumber: true } } }, orderBy: { role: "asc" } },
    },
  });
  if (!house) redirect("/admin/population/houses");

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="break-words text-2xl font-bold text-gray-900">บ้านเลขที่ {house.houseNumber}</h1><p className="mt-1 text-sm text-gray-500">ข้อมูลบ้าน ประชากร และบัญชีผู้ใช้ที่ผูกอยู่</p></div><div className="flex flex-wrap gap-2"><Link href="/admin/population/houses" className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">กลับไปทะเบียนบ้าน</Link><DeleteHouseButton houseId={house.id} houseNumber={house.houseNumber} /></div></div>

    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="rounded-xl border border-gray-200 bg-white p-5"><p className="text-xs text-gray-500">ที่อยู่เพิ่มเติม</p><p className="mt-2 break-words font-medium text-gray-900">{house.address ?? "ไม่ได้ระบุ"}</p></div>
      <div className="rounded-xl border border-gray-200 bg-white p-5"><p className="text-xs text-gray-500">จำนวนคนในทะเบียน</p><p className="mt-1 text-3xl font-bold text-gray-900">{house.persons.length.toLocaleString("th-TH")}</p></div>
      <div className="rounded-xl border border-gray-200 bg-white p-5"><p className="text-xs text-gray-500">สมาชิกที่ผูกบ้าน</p><p className="mt-1 text-3xl font-bold text-gray-900">{house.memberships.length.toLocaleString("th-TH")}</p></div>
    </section>

    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3"><h2 className="font-semibold text-gray-900">รายชื่อบุคคลในทะเบียนบ้าน</h2><Link href={historyEnabled ? `/admin/population/houses/${house.id}` : `/admin/population/houses/${house.id}?history=1`} aria-label={`${historyEnabled ? "ปิด" : "เปิด"}การแสดงทั้งหมด`} aria-pressed={historyEnabled} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"><span>ทั้งหมด</span><span className={`relative h-4 w-7 rounded-full transition-colors ${historyEnabled ? "bg-green-600" : "bg-gray-300"}`} aria-hidden="true"><span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${historyEnabled ? "translate-x-3.5" : "translate-x-0.5"}`} /></span></Link></div>{house.persons.length === 0 ? <p className="px-4 py-8 text-sm text-gray-500">ยังไม่มีข้อมูลบุคคลในทะเบียนบ้านนี้</p> : <div className="overflow-x-auto"><table className="min-w-[620px] w-full text-sm"><thead className="bg-gray-50 text-left text-gray-600"><tr><th className="px-4 py-3">ชื่อ-นามสกุล</th><th className="px-4 py-3">เลขบัตรประชาชน</th><th className="px-4 py-3">ติดต่อ</th><th className="px-4 py-3">สถานะ</th></tr></thead><tbody>{house.persons.map((person) => <tr key={person.id} className="border-t border-gray-100"><td className="px-4 py-3 font-medium text-gray-900"><Link href={`/admin/population/people/${person.id}`} className="hover:text-blue-700 hover:underline">{person.firstName} {person.lastName}</Link></td><td className="px-4 py-3 text-gray-700">{person.nationalId ? maskNationalId(person.nationalId) : "-"}</td><td className="px-4 py-3 text-gray-700">{person.phone ?? "-"}</td><td className="px-4 py-3"><Badge variant={person.status === "ACTIVE" ? "success" : person.status === "MOVED_OUT" ? "warning" : "default"}>{PERSON_STATUS_LABELS[person.status]}</Badge></td></tr>)}</tbody></table></div>}</section>

    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white"><div className="border-b border-gray-200 px-4 py-3"><h2 className="font-semibold text-gray-900">บัญชีผู้ใช้ที่ผูกกับบ้านนี้</h2></div>{house.memberships.length === 0 ? <p className="px-4 py-8 text-sm text-gray-500">ยังไม่มีบัญชีผู้ใช้ที่ผูกกับบ้านหลังนี้</p> : <div className="overflow-x-auto"><table className="min-w-[620px] w-full text-sm"><thead className="bg-gray-50 text-left text-gray-600"><tr><th className="px-4 py-3">ผู้ใช้งาน</th><th className="px-4 py-3">เบอร์โทร</th><th className="px-4 py-3">บทบาท</th><th className="px-4 py-3">สถานะ</th></tr></thead><tbody>{house.memberships.map((item) => <tr key={item.id} className="border-t border-gray-100"><td className="px-4 py-3 font-medium text-gray-900">{item.user.name}</td><td className="px-4 py-3 text-gray-700">{item.user.phoneNumber}</td><td className="px-4 py-3 text-gray-700">{MEMBERSHIP_ROLE_LABELS[item.role] ?? item.role}</td><td className="px-4 py-3"><Badge variant="success">{MEMBERSHIP_STATUS_LABELS[item.status] ?? item.status}</Badge></td></tr>)}</tbody></table></div>}</section>
  </div>;
}
