import Link from "next/link";
import { PopulationImportStage } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { POPULATION_IMPORT_COLUMNS } from "@/features/population/server/import-template";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { getWorkspaceVillage } from "@/features/village-workspace/server/queries";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { WorkspacePopulationImportForm } from "./workspace-import-form";

export default async function Page({ params }: { params: Promise<{ villageId: string }> }) {
  await requireSuperAdminPageSession();
  const { villageId } = await params;
  const [village, jobs] = await Promise.all([
    getWorkspaceVillage(villageId),
    prisma.populationImportJob.findMany({ where: { villageId }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const base = `/superadmin/villages/${villageId}/population/import`;
  return <div className="space-y-5 pb-6">
    <SuperAdminPageHeaderRegistration priority={1} context={{ title: "นำเข้าข้อมูลประชากร", description: `ตรวจสอบชุดข้อมูลก่อนนำเข้า ${village.name}` }} />
    <header className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">นำเข้าด้วยแบบฟอร์มมาตรฐานเดียวกับผู้ดูแลหมู่บ้าน และตรวจสอบผลก่อนยืนยัน</p><Link className="inline-flex min-h-10 items-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50" href={`/superadmin/villages/${villageId}/population/export`}>ส่งออกข้อมูล</Link></header>
    <WorkspacePopulationImportForm villageId={villageId} />
    <section className="rounded-xl border bg-white p-5"><h3 className="font-semibold">งานนำเข้าล่าสุด</h3><div className="mt-3 divide-y">{jobs.map((job) => <Link key={job.id} href={`${base}/${job.id}`} className="flex flex-col gap-2 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{job.fileName}</p><p className="text-xs text-slate-500">{job.createdAt.toLocaleString("th-TH")} · {job.totalRows} แถว · ผ่าน {job.importedRows} · มีปัญหา {job.failedRows}</p></div><Badge variant={job.stage === PopulationImportStage.COMPLETED ? "success" : job.stage === PopulationImportStage.FAILED ? "danger" : "warning"}>{job.stage}</Badge></Link>)}{!jobs.length ? <p className="py-8 text-center text-sm text-slate-500">ยังไม่มีงานนำเข้า</p> : null}</div></section>
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><h3 className="font-semibold text-gray-900">รูปแบบไฟล์ที่รองรับ</h3><p className="mt-2 text-sm text-gray-600">Excel/CSV · {POPULATION_IMPORT_COLUMNS.length} คอลัมน์มาตรฐาน โดย house_number, first_name และ last_name เป็นข้อมูลหลัก</p></section>
  </div>;
}
