import Link from "next/link";
import { notFound } from "next/navigation";
import { VillagePersonForm } from "@/features/population/components/village-person-form";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { createSuperAdminPersonAction } from "../../population-actions";

export default async function Page({ params }: { params: Promise<{ villageId: string }> }) {
  await requireSuperAdminPageSession();
  const { villageId } = await params;
  const [village, houses] = await Promise.all([prisma.village.findUnique({ where: { id: villageId }, select: { name: true } }), prisma.house.findMany({ where: { villageId }, select: { id: true, houseNumber: true }, orderBy: { houseNumber: "asc" } })]);
  if (!village) notFound();
  const base = `/superadmin/villages/${villageId}/people`;
  return <div className="mx-auto max-w-4xl space-y-5"><header><Link href={base} className="text-sm text-slate-500 hover:text-slate-900">← กลับทะเบียนประชากร</Link><h1 className="mt-2 text-2xl font-bold text-gray-900">เพิ่มบุคคล</h1><p className="mt-1 text-sm text-slate-500">เพิ่มข้อมูลเข้า {village.name}; รายการบ้านจำกัดเฉพาะหมู่บ้านนี้</p></header><VillagePersonForm mode="create" action={createSuperAdminPersonAction.bind(null, villageId)} houseOptions={houses.map((house) => ({ value: house.id, label: `บ้านเลขที่ ${house.houseNumber}` }))} successHref={(id) => `${base}/${id}`} /></div>;
}
