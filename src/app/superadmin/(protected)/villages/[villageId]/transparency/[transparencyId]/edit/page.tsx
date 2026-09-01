import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { prisma } from "@/lib/prisma";
import { SuperAdminTransparencyForm } from "../../superadmin-transparency-form";

export default async function EditTransparencyPage({ params }: { params: Promise<{ villageId: string; transparencyId: string }> }) {
  const { villageId, transparencyId } = await params; const record = await prisma.transparencyRecord.findFirst({ where: { id: transparencyId, villageId } }); if (!record) notFound();
  return <div className="mx-auto flex w-full max-w-3xl flex-col gap-3"><SuperAdminPageHeaderRegistration priority={1} context={{ title: "แก้ไขรายการความโปร่งใส", description: "อัปเดตข้อมูลรายการความโปร่งใส" }} /><Link href={`/superadmin/villages/${villageId}/transparency/${transparencyId}`} className="inline-flex min-h-9 items-center gap-1.5 self-start px-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" />กลับรายละเอียดรายการ</Link><SuperAdminTransparencyForm villageId={villageId} initial={record} cancelHref={`/superadmin/villages/${villageId}/transparency/${transparencyId}`} /></div>;
}
