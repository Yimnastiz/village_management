import { FileSpreadsheet, Home, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { PopulationExportForm } from "@/features/population/components/population-export-form";
import { getWorkspaceVillage } from "@/features/village-workspace/server/queries";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";

export default async function Page({ params }: { params: Promise<{ villageId: string }> }) {
  await requireSuperAdminPageSession();
  const { villageId } = await params;
  const [village, houseCount, peopleCount, accountCount, zones] = await Promise.all([
    getWorkspaceVillage(villageId),
    prisma.house.count({ where: { villageId } }),
    prisma.person.count({ where: { villageId } }),
    prisma.villageMembership.count({ where: { villageId } }),
    prisma.villageZone.findMany({ where: { villageId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const endpoint = `/api/superadmin/villages/${villageId}/population/export`;

  return <div className="space-y-5 pb-6">
    <SuperAdminPageHeaderRegistration priority={1} context={{ title: "ส่งออกข้อมูลประชากร", description: `ส่งออกข้อมูลของ ${village.name} เพื่อการสนับสนุนงานหมู่บ้าน` }} />
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><h2 className="text-base font-semibold text-gray-900">ตั้งค่าการส่งออก</h2><p className="mt-1 text-sm text-gray-500">เลือกชุดข้อมูล ขอบเขต และระดับข้อมูลก่อนดาวน์โหลด</p></div>
        <PopulationExportForm zones={zones} canExportFullRegistry endpoint={endpoint} reasonParam="supportReason" />
      </div>
    </section>

    <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-950">ไฟล์ข้อมูลเต็มอาจมีข้อมูลส่วนบุคคล การส่งออกข้อมูลเต็มต้องระบุเหตุผล และระบบจะบันทึกการดำเนินการพร้อมแจ้งผู้ดูแลหมู่บ้าน</p>

    <section className="grid gap-3 sm:grid-cols-3">
      <article className="rounded-xl border border-gray-200 bg-white p-4"><p className="flex items-center gap-2 text-sm text-gray-500"><Home className="h-4 w-4" />ทะเบียนบ้าน</p><p className="mt-2 text-2xl font-semibold text-gray-900">{houseCount.toLocaleString("th-TH")}</p></article>
      <article className="rounded-xl border border-gray-200 bg-white p-4"><p className="flex items-center gap-2 text-sm text-gray-500"><Users className="h-4 w-4" />ทะเบียนประชากร</p><p className="mt-2 text-2xl font-semibold text-gray-900">{peopleCount.toLocaleString("th-TH")}</p></article>
      <article className="rounded-xl border border-gray-200 bg-white p-4"><p className="flex items-center gap-2 text-sm text-gray-500"><FileSpreadsheet className="h-4 w-4" />บัญชีสมาชิกที่ผูกไว้</p><p className="mt-2 text-2xl font-semibold text-gray-900">{accountCount.toLocaleString("th-TH")}</p></article>
    </section>

    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><div className="flex flex-wrap gap-2"><Badge variant="info">Excel .xlsx</Badge><Badge variant="outline">สรุปข้อมูล</Badge><Badge variant="outline">บ้าน</Badge><Badge variant="outline">ประชากร</Badge><Badge variant="outline">บัญชีสมาชิก</Badge></div><p className="mt-3 text-sm leading-5 text-gray-600">ไฟล์จะมีแผ่นงานสรุป และแผ่นงานตามชุดข้อมูลที่เลือก โดยจำกัดเฉพาะข้อมูลของหมู่บ้านนี้</p></section>
  </div>;
}
