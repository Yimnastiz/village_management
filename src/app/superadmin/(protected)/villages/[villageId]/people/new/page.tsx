import { notFound } from "next/navigation";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
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
  return <div className="mx-auto max-w-4xl space-y-5"><SuperAdminPageHeaderRegistration priority={1} context={{ title: "เพิ่มบุคคล", description: `เพิ่มข้อมูลประชากรของ ${village.name} เพื่อการสนับสนุนงานหมู่บ้าน` }} /><VillagePersonForm mode="create" action={createSuperAdminPersonAction.bind(null, villageId)} houseOptions={houses.map((house) => ({ value: house.id, label: `บ้านเลขที่ ${house.houseNumber}` }))} successPath={base} confirmReason /></div>;
}
