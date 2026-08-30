import Link from "next/link";
import { PersonStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { personStatusBadgeVariant } from "@/features/population/person-status";
import { MEMBERSHIP_ROLE_LABELS, MEMBERSHIP_STATUS_LABELS, MOVEMENT_TYPE_LABELS, PERSON_STATUS_LABELS } from "@/lib/constants";
import { normalizePersonGender } from "@/lib/person-validation";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { maskNationalId } from "@/lib/utils";
import { SuperAdminPersonLifecycleActions } from "./person-lifecycle-actions";

function statusVariant(status: PersonStatus): "success" | "warning" | "default" { return personStatusBadgeVariant(status); }
function toThaiDate(value: Date | null): string { return value ? value.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" }) : "-"; }
function maskLoginPhone(value: string) { return value.length < 7 ? value : `${value.slice(0, 3)}-${"x".repeat(Math.max(3, value.length - 7))}-${value.slice(-4)}`; }

export default async function Page({ params }: { params: Promise<{ villageId: string; personId: string }> }) {
  await requireSuperAdminPageSession();
  const { villageId, personId } = await params;
  const base = `/superadmin/villages/${villageId}`;
  const person = await prisma.person.findFirst({
    where: { id: personId, villageId },
    include: {
      house: { select: { id: true, houseNumber: true } },
      movements: { include: { house: { select: { houseNumber: true } } }, orderBy: { date: "desc" }, take: 20 },
      // Person.userId is the authoritative identity link. Do not infer a user from phone;
      // legacy records without userId intentionally remain unlinked until reconciled.
      user: { select: { id: true, name: true, phoneNumber: true, email: true, accountStatus: true, memberships: { where: { villageId }, select: { role: true, status: true }, take: 1 } } },
    },
  });
  if (!person) notFound();
  const linkedMembership = person.user?.memberships[0] ?? null;
  const canRecordLifecycle = person.status === PersonStatus.ACTIVE || person.status === PersonStatus.UNKNOWN;

  return <div className="space-y-5">
    <header className="space-y-3"><div className="flex flex-wrap items-end justify-between gap-3"><div><Link href={`${base}/people`} className="text-sm text-slate-500 hover:text-slate-900">← กลับทะเบียนประชากร</Link><h1 className="mt-2 text-2xl font-bold text-gray-900">{person.firstName} {person.lastName}</h1><p className="mt-1 text-sm text-gray-500">ข้อมูลทะเบียน ประวัติการอยู่อาศัย และบัญชีผู้ใช้ที่เชื่อมโยง</p></div><div className="flex flex-wrap gap-2">{canRecordLifecycle ? <><Link href={`${base}/people/${person.id}/edit`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">แก้ไขข้อมูล</Link><SuperAdminPersonLifecycleActions villageId={villageId} personId={person.id} /></> : null}</div></div>{person.status === PersonStatus.MOVED_OUT ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">บุคคลนี้ถูกย้ายออกจากทะเบียนแล้ว หากกลับมาอยู่ใหม่ ให้ดำเนินการผ่านการผูกเลขบ้านใหม่</p> : null}{person.status === PersonStatus.DECEASED ? <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">บุคคลนี้ถูกบันทึกว่าเสียชีวิต ประวัติยังคงเก็บไว้ และไม่สามารถแก้ไขหรือทำรายการวงจรชีวิตซ้ำได้</p> : null}</header>
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-gray-900">ข้อมูลทะเบียน</h2><Badge variant={statusVariant(person.status)}>{PERSON_STATUS_LABELS[person.status] ?? person.status}</Badge></div><dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3"><Detail label="เลขบัตรประชาชน" value={person.nationalId ? maskNationalId(person.nationalId) : "-"} /><Detail label="วันเกิด" value={toThaiDate(person.dateOfBirth)} /><Detail label="เพศ" value={normalizePersonGender(person.gender) ?? "-"} /><Detail label="เบอร์โทรสำหรับติดต่อ" value={person.phone ?? "-"} /><Detail label="อีเมลสำหรับติดต่อ" value={person.email ?? "-"} className="break-all" /><div><dt className="text-gray-500">{person.status === PersonStatus.DECEASED ? "บ้านที่บันทึกล่าสุด" : "บ้านปัจจุบัน"}</dt><dd className="mt-1 font-medium text-gray-900">{person.house ? <Link href={`${base}/houses/${person.house.id}`} className="text-blue-600 hover:text-blue-700 hover:underline">{person.house.houseNumber}</Link> : "-"}</dd></div></dl></section>
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white"><div className="border-b border-gray-200 px-4 py-3"><h2 className="font-semibold text-gray-900">บัญชีผู้ใช้</h2></div>{!person.user ? <p className="px-4 py-8 text-sm text-gray-500">ยังไม่มีบัญชีผู้ใช้เชื่อมกับข้อมูลบุคคลนี้</p> : <div className="flex min-w-0 items-start gap-3 p-4 sm:items-center"><div aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700">{person.user.name.trim().slice(0, 1) || "ผ"}</div><div className="min-w-0 flex-1"><p className="truncate font-medium text-gray-900">{person.user.name}</p><p className="mt-0.5 break-all text-sm text-gray-600">เบอร์เข้าสู่ระบบ {maskLoginPhone(person.user.phoneNumber)}</p>{person.user.email && !person.user.email.endsWith("@local.invalid") ? <p className="mt-0.5 break-all text-sm text-gray-600">อีเมลบัญชี {person.user.email}</p> : null}<div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">{linkedMembership ? <><span>{MEMBERSHIP_ROLE_LABELS[linkedMembership.role] ?? linkedMembership.role}</span><span aria-hidden="true">·</span><Badge variant={linkedMembership.status === "ACTIVE" ? "success" : linkedMembership.status === "SUSPENDED" ? "warning" : "default"}>{MEMBERSHIP_STATUS_LABELS[linkedMembership.status] ?? linkedMembership.status}</Badge></> : <span>ไม่มี membership ของหมู่บ้านนี้ · สถานะบัญชี {person.user.accountStatus === "ACTIVE" ? "ใช้งานอยู่" : "ไม่พร้อมใช้งาน"}</span>}</div></div></div>}</section>
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white"><div className="border-b border-gray-200 px-4 py-3"><h2 className="font-semibold text-gray-900">ประวัติการย้ายล่าสุด</h2></div>{!person.movements.length ? <p className="px-4 py-8 text-sm text-gray-500">ยังไม่มีประวัติการย้าย</p> : <div className="overflow-x-auto"><table className="min-w-[640px] w-full text-sm"><thead className="bg-gray-50 text-left text-gray-600"><tr><th className="px-4 py-3">วันที่</th><th className="px-4 py-3">ประเภท</th><th className="px-4 py-3">บ้าน</th><th className="px-4 py-3">หมายเหตุ</th></tr></thead><tbody>{person.movements.map((movement) => <tr key={movement.id} className="border-t border-gray-100"><td className="px-4 py-3 text-gray-700">{toThaiDate(movement.date)}</td><td className="px-4 py-3 text-gray-700">{MOVEMENT_TYPE_LABELS[movement.movementType] ?? movement.movementType}</td><td className="px-4 py-3 text-gray-700">{movement.house?.houseNumber ?? "-"}</td><td className="px-4 py-3 text-gray-700">{movement.note ?? "-"}</td></tr>)}</tbody></table></div>}</section>
    <section className="rounded-xl border border-gray-200 bg-white p-4 text-sm"><h2 className="font-semibold text-gray-900">ข้อมูลระบบ</h2><dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Detail label="รหัสบุคคล" value={person.id} className="break-all" /><Detail label="สร้างเมื่อ" value={person.createdAt.toLocaleString("th-TH")} /><Detail label="แก้ไขล่าสุด" value={person.updatedAt.toLocaleString("th-TH")} /></dl></section>
  </div>;
}

function Detail({ label, value, className }: { label: string; value: string; className?: string }) { return <div><dt className="text-gray-500">{label}</dt><dd className={`mt-1 font-medium text-gray-900 ${className ?? ""}`}>{value}</dd></div>; }
