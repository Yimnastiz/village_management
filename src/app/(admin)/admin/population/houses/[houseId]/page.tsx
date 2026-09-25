import Link from "next/link";
import { AccountEmailStatus, PersonStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PERSON_STATUS_LABELS } from "@/lib/constants";
import { getVillagePermissionContext } from "@/lib/admin-permission.server";
import { prisma } from "@/lib/prisma";
import { maskNationalId } from "@/lib/utils";
import { DeleteHouseButton } from "../delete-house-button";

export default async function Page({ params, searchParams }: { params: Promise<{ houseId: string }>; searchParams?: Promise<{ history?: string }> }) {
  const { houseId } = await params;
  const historyEnabled = (await searchParams)?.history === "1";
  const context = await getVillagePermissionContext("population.house.manage");
  if (!context) redirect("/auth/login?callbackUrl=/admin/population/houses");
  const membership = context.membership;

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
      residentHouseAccount: {
        include: { accountEmails: { where: { status: AccountEmailStatus.ACTIVE }, select: { email: true }, orderBy: { createdAt: "asc" } } },
      },
    },
  });
  if (!house) redirect("/admin/population/houses");

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="break-words text-2xl font-bold text-gray-900">บ้านเลขที่ {house.houseNumber}</h1><p className="mt-1 text-sm text-gray-500">ข้อมูลบ้าน ประชากร และบัญชีบ้าน</p></div><div className="flex flex-wrap gap-2"><Link href="/admin/population/houses" className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">กลับไปทะเบียนบ้าน</Link><DeleteHouseButton houseId={house.id} houseNumber={house.houseNumber} /></div></div>

    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="rounded-xl border border-gray-200 bg-white p-5"><p className="text-xs text-gray-500">ที่อยู่เพิ่มเติม</p><p className="mt-2 break-words font-medium text-gray-900">{house.address ?? "ไม่ได้ระบุ"}</p></div>
      <div className="rounded-xl border border-gray-200 bg-white p-5"><p className="text-xs text-gray-500">จำนวนคนในทะเบียน</p><p className="mt-1 text-3xl font-bold text-gray-900">{house.persons.length.toLocaleString("th-TH")}</p></div>
      <div className="rounded-xl border border-gray-200 bg-white p-5"><p className="text-xs text-gray-500">สถานะบัญชีบ้าน</p><p className="mt-2 font-semibold text-gray-900">{house.residentHouseAccount?.activatedAt && !house.residentHouseAccount.suspendedAt ? "ใช้งานอยู่" : "ยังไม่มีบัญชีที่ใช้งาน"}</p></div>
    </section>

    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3"><h2 className="font-semibold text-gray-900">รายชื่อบุคคลในทะเบียนบ้าน</h2><Link href={historyEnabled ? `/admin/population/houses/${house.id}` : `/admin/population/houses/${house.id}?history=1`} aria-label={`${historyEnabled ? "ปิด" : "เปิด"}การแสดงทั้งหมด`} aria-pressed={historyEnabled} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"><span>ทั้งหมด</span><span className={`relative h-4 w-7 rounded-full transition-colors ${historyEnabled ? "bg-green-600" : "bg-gray-300"}`} aria-hidden="true"><span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${historyEnabled ? "translate-x-3.5" : "translate-x-0.5"}`} /></span></Link></div>{house.persons.length === 0 ? <p className="px-4 py-8 text-sm text-gray-500">ยังไม่มีข้อมูลบุคคลในทะเบียนบ้านนี้</p> : <div className="overflow-x-auto"><table className="min-w-[620px] w-full text-sm"><thead className="bg-gray-50 text-left text-gray-600"><tr><th className="px-4 py-3">ชื่อ-นามสกุล</th><th className="px-4 py-3">เลขบัตรประชาชน</th><th className="px-4 py-3">ติดต่อ</th><th className="px-4 py-3">สถานะ</th></tr></thead><tbody>{house.persons.map((person) => <tr key={person.id} className="border-t border-gray-100"><td className="px-4 py-3 font-medium text-gray-900"><Link href={`/admin/population/people/${person.id}`} className="hover:text-blue-700 hover:underline">{person.firstName} {person.lastName}</Link></td><td className="px-4 py-3 text-gray-700">{person.nationalId ? maskNationalId(person.nationalId) : "-"}</td><td className="px-4 py-3 text-gray-700">{person.phone ?? "-"}</td><td className="px-4 py-3"><Badge variant={person.status === "ACTIVE" ? "success" : person.status === "MOVED_OUT" ? "warning" : "default"}>{PERSON_STATUS_LABELS[person.status]}</Badge></td></tr>)}</tbody></table></div>}</section>

    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white"><div className="border-b border-gray-200 px-4 py-3"><h2 className="font-semibold text-gray-900">บัญชีบ้าน</h2></div>{!house.residentHouseAccount ? <p className="px-4 py-8 text-sm text-gray-500">ยังไม่มีบัญชีบ้านสำหรับบ้านหลังนี้</p> : <dl className="grid gap-4 p-4 text-sm sm:grid-cols-2"><div><dt className="text-gray-500">โทรศัพท์ติดต่อ</dt><dd className="mt-1 font-medium text-gray-900">{house.residentHouseAccount.contactPhone}</dd></div><div><dt className="text-gray-500">อีเมลเข้าสู่ระบบ</dt><dd className="mt-1 space-y-1 font-medium text-gray-900">{house.residentHouseAccount.accountEmails.map((item) => <span key={item.email} className="block break-all">{item.email}</span>)}</dd></div></dl>}</section>
  </div>;
}
