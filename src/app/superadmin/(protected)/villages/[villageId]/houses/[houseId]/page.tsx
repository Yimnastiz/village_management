import Link from "next/link";
import { MembershipStatus, PersonStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { personStatusBadgeVariant } from "@/features/population/person-status";
import { HOUSE_SOURCE_TYPE_LABELS, MEMBERSHIP_ROLE_LABELS, MEMBERSHIP_STATUS_LABELS, PERSON_STATUS_LABELS } from "@/lib/constants";
import { maskNationalId } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { DeleteSuperAdminHouseButton } from "./delete-superadmin-house-button";
import { EditSuperAdminHouseDialog } from "./edit-superadmin-house-dialog";

function statusVariant(status: PersonStatus): "success" | "warning" | "default" { return personStatusBadgeVariant(status); }

export default async function Page({ params, searchParams }: { params: Promise<{ villageId: string; houseId: string }>; searchParams: Promise<{ history?: string }> }) {
  await requireSuperAdminPageSession();
  const { villageId, houseId } = await params;
  const historyEnabled = (await searchParams).history === "1";
  const base = `/superadmin/villages/${villageId}`;
  const house = await prisma.house.findFirst({
    where: { id: houseId, villageId },
    include: {
      village: { select: { name: true } },
      zone: { select: { name: true } },
      persons: {
        where: historyEnabled ? { status: { in: [PersonStatus.ACTIVE, PersonStatus.MOVED_OUT, PersonStatus.DECEASED] } } : { status: PersonStatus.ACTIVE },
        select: { id: true, firstName: true, lastName: true, nationalId: true, phone: true, status: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      },
      memberships: { where: { villageId, status: MembershipStatus.ACTIVE }, include: { user: { select: { name: true, phoneNumber: true } } }, orderBy: { role: "asc" } },
    },
  });
  if (!house) notFound();
  const historyHref = historyEnabled ? `${base}/houses/${house.id}` : `${base}/houses/${house.id}?history=1`;

  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><Link href={`${base}/houses`} className="text-sm text-slate-500 hover:text-slate-900">← กลับทะเบียนบ้าน</Link><h1 className="mt-2 break-words text-2xl font-bold text-gray-900">บ้านเลขที่ {house.houseNumber}</h1><p className="mt-1 text-sm text-gray-500">{house.village.name} · ข้อมูลบ้าน ประชากร และบัญชีผู้ใช้ที่ผูกอยู่</p></div><div className="flex flex-wrap gap-2"><EditSuperAdminHouseDialog villageId={villageId} houseId={house.id} houseNumber={house.houseNumber} address={house.address ?? ""} /><DeleteSuperAdminHouseButton villageId={villageId} houseId={house.id} houseNumber={house.houseNumber} /></div></header>
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Summary label="ที่อยู่เพิ่มเติม" value={house.address ?? "ไม่ได้ระบุ"} /><Summary label="ประชากรปัจจุบัน" value={`${house.persons.filter((person) => person.status === PersonStatus.ACTIVE).length.toLocaleString("th-TH")} คน`} /><Summary label="สมาชิกที่ผูกบ้าน" value={`${house.memberships.length.toLocaleString("th-TH")} บัญชี`} /><Summary label="โซน" value={house.zone?.name ?? "-"} /></section>
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3"><h2 className="font-semibold text-gray-900">รายชื่อบุคคลในทะเบียนบ้าน</h2><Link href={historyHref} aria-label={`${historyEnabled ? "ปิด" : "เปิด"}การแสดงทั้งหมด`} aria-pressed={historyEnabled} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"><span>ทั้งหมด</span><span className={`relative h-4 w-7 rounded-full transition-colors ${historyEnabled ? "bg-green-600" : "bg-gray-300"}`} aria-hidden="true"><span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${historyEnabled ? "translate-x-3.5" : "translate-x-0.5"}`} /></span></Link></div>{!house.persons.length ? <p className="px-4 py-8 text-sm text-gray-500">ยังไม่มีข้อมูลบุคคลในทะเบียนบ้านนี้</p> : <div className="overflow-x-auto"><table className="min-w-[680px] w-full text-sm"><thead className="bg-gray-50 text-left text-gray-600"><tr><th className="px-4 py-3">ชื่อ-นามสกุล</th><th className="px-4 py-3">เลขบัตรประชาชน</th><th className="px-4 py-3">ติดต่อ</th><th className="px-4 py-3">สถานะ</th></tr></thead><tbody>{house.persons.map((person) => <tr key={person.id} className="border-t border-gray-100"><td className="px-4 py-3 font-medium text-gray-900"><Link href={`${base}/people/${person.id}`} className="hover:text-blue-700 hover:underline">{person.firstName} {person.lastName}</Link></td><td className="px-4 py-3 text-gray-700">{person.nationalId ? maskNationalId(person.nationalId) : "-"}</td><td className="px-4 py-3 text-gray-700">{person.phone ?? "-"}</td><td className="px-4 py-3"><Badge variant={statusVariant(person.status)}>{PERSON_STATUS_LABELS[person.status] ?? person.status}</Badge></td></tr>)}</tbody></table></div>}</section>
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white"><div className="border-b border-gray-200 px-4 py-3"><h2 className="font-semibold text-gray-900">บัญชีผู้ใช้ที่ผูกกับบ้านนี้</h2></div>{!house.memberships.length ? <p className="px-4 py-8 text-sm text-gray-500">ยังไม่มีบัญชีผู้ใช้ที่ผูกกับบ้านหลังนี้</p> : <div className="overflow-x-auto"><table className="min-w-[620px] w-full text-sm"><thead className="bg-gray-50 text-left text-gray-600"><tr><th className="px-4 py-3">ผู้ใช้งาน</th><th className="px-4 py-3">เบอร์โทร</th><th className="px-4 py-3">บทบาท</th><th className="px-4 py-3">สถานะ</th></tr></thead><tbody>{house.memberships.map((item) => <tr key={item.id} className="border-t border-gray-100"><td className="px-4 py-3 font-medium text-gray-900">{item.user.name}</td><td className="px-4 py-3 text-gray-700">{item.user.phoneNumber}</td><td className="px-4 py-3 text-gray-700">{MEMBERSHIP_ROLE_LABELS[item.role] ?? item.role}</td><td className="px-4 py-3"><Badge variant="success">{MEMBERSHIP_STATUS_LABELS[item.status] ?? item.status}</Badge></td></tr>)}</tbody></table></div>}</section>
    <section className="rounded-xl border border-gray-200 bg-white p-4 text-sm"><h2 className="font-semibold text-gray-900">ข้อมูลระบบ</h2><dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Detail label="แหล่งข้อมูล" value={HOUSE_SOURCE_TYPE_LABELS[house.sourceType] ?? house.sourceType} /><Detail label="หมายเหตุแหล่งข้อมูล" value={house.sourceNote ?? "-"} /><Detail label="ยืนยันเมื่อ" value={house.verifiedAt?.toLocaleString("th-TH") ?? "-"} /><Detail label="สร้างเมื่อ" value={house.createdAt.toLocaleString("th-TH")} /><Detail label="แก้ไขล่าสุด" value={house.updatedAt.toLocaleString("th-TH")} /></dl></section>
  </div>;
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">{label}</p><p className="mt-2 break-words font-semibold text-gray-900">{value}</p></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-gray-500">{label}</dt><dd className="mt-1 break-words font-medium text-gray-900">{value}</dd></div>; }
