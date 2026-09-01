import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { SuperAdminTransparencyForm } from "../superadmin-transparency-form";

export default async function NewTransparencyPage({ params }: { params: Promise<{ villageId: string }> }) {
  const { villageId } = await params;
  return <div className="mx-auto flex w-full max-w-3xl flex-col gap-3"><SuperAdminPageHeaderRegistration priority={1} context={{ title: "เพิ่มรายการความโปร่งใส", description: "เพิ่มข้อมูลที่ต้องการเปิดเผยให้ประชาชนหรือลูกบ้านตรวจสอบ" }} /><Link href={`/superadmin/villages/${villageId}/transparency`} className="inline-flex min-h-9 items-center gap-1.5 self-start px-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" />กลับรายการความโปร่งใส</Link><SuperAdminTransparencyForm villageId={villageId} /></div>;
}
