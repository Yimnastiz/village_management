import Link from "next/link";
import { PersonStatus } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { VillagePersonForm } from "@/features/population/components/village-person-form";
import { normalizePersonGender } from "@/lib/person-validation";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { updateSuperAdminPersonAction } from "../../../population-actions";

function toInputDate(value: Date | null): string { return value ? value.toISOString().slice(0, 10) : ""; }

export default async function Page({ params }: { params: Promise<{ villageId: string; personId: string }> }) {
  await requireSuperAdminPageSession();
  const { villageId, personId } = await params;
  const [person, houses] = await Promise.all([prisma.person.findFirst({ where: { id: personId, villageId } }), prisma.house.findMany({ where: { villageId }, select: { id: true, houseNumber: true }, orderBy: { houseNumber: "asc" } })]);
  if (!person) notFound();
  const detailHref = `/superadmin/villages/${villageId}/people/${person.id}`;
  // Match the Admin route guard; hiding the edit link is not sufficient for a direct URL.
  if (person.status === PersonStatus.MOVED_OUT || person.status === PersonStatus.DECEASED) redirect(detailHref);
  return <div className="mx-auto max-w-4xl space-y-5"><header><Link href={detailHref} className="text-sm text-slate-500 hover:text-slate-900">← กลับรายละเอียดบุคคล</Link><h1 className="mt-2 text-2xl font-bold text-gray-900">แก้ไขข้อมูลบุคคล</h1><p className="mt-1 text-sm text-gray-500">ปรับปรุงข้อมูลทะเบียน โดยแยกจากข้อมูลเข้าสู่ระบบของบัญชีผู้ใช้</p></header><VillagePersonForm mode="edit" action={updateSuperAdminPersonAction.bind(null, villageId, personId)} houseOptions={houses.map((house) => ({ value: house.id, label: `บ้านเลขที่ ${house.houseNumber}` }))} defaultValues={{ firstName: person.firstName, lastName: person.lastName, nationalId: person.nationalId ?? "", dateOfBirth: toInputDate(person.dateOfBirth), gender: normalizePersonGender(person.gender) ?? "ไม่ระบุ", phone: person.phone ?? "", email: person.email ?? "", houseId: person.houseId ?? "" }} successPath={detailHref} /></div>;
}
