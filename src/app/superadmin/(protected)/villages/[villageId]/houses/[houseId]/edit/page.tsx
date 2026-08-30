import Link from "next/link";
import { notFound } from "next/navigation";
import { HouseForm } from "@/features/population/components/house-form";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { updateSuperAdminHouseAction } from "../../../population-actions";

export default async function EditHousePage({ params }: { params: Promise<{ villageId: string; houseId: string }> }) {
  await requireSuperAdminPageSession();
  const { villageId, houseId } = await params;
  const house = await prisma.house.findFirst({ where: { id: houseId, villageId }, select: { id: true, houseNumber: true, address: true } });
  if (!house) notFound();
  const detailHref = `/superadmin/villages/${villageId}/houses/${houseId}`;
  return <div className="mx-auto max-w-4xl space-y-5"><header><Link href={detailHref} className="text-sm text-slate-500 hover:text-slate-900">← กลับรายละเอียดบ้าน</Link><h1 className="mt-2 text-2xl font-bold text-gray-900">แก้ไขข้อมูลบ้าน</h1><p className="mt-1 text-sm text-gray-500">การแก้ไขจะถูกบันทึกพร้อมเหตุผลใน Audit Log</p></header><HouseForm mode="edit" action={updateSuperAdminHouseAction.bind(null, villageId, houseId)} defaults={{ houseNumber: house.houseNumber, address: house.address ?? "" }} requireReason onSuccess={() => undefined} /></div>;
}
