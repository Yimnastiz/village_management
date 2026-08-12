import Link from "next/link";
import { PopulationImportStage } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { PopulationImportForm } from "@/app/(admin)/admin/population/import/import-form";
import { POPULATION_IMPORT_COLUMNS } from "@/features/population/server/import-template";
import { getWorkspaceVillage } from "@/features/village-workspace/server/queries";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { importForWorkspaceAction } from "./actions";

export default async function Page({ params }: { params: Promise<{ villageId: string }> }) {
  await requireSuperAdminPageSession();
  const { villageId } = await params;
  const [village, jobs] = await Promise.all([
    getWorkspaceVillage(villageId),
    prisma.populationImportJob.findMany({ where: { villageId }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const base = `/superadmin/villages/${villageId}/population/import`;
  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold">นำเข้าข้อมูลประชากร</h2><p className="mt-1 text-sm text-slate-500">ตรวจสอบ Preview ก่อนบันทึกเข้า {village.name}; ขอบเขตหมู่บ้านถูกผูกจาก route ฝั่ง server</p></div><Link className="rounded-lg border px-3 py-2 text-sm" href={`/superadmin/villages/${villageId}/population/export`}>ไปหน้าส่งออก</Link></header>
    <PopulationImportForm targetVillageId={villageId} templateHref="/api/superadmin/population/import-template" importAction={importForWorkspaceAction.bind(null, villageId)} />
    <section className="rounded-xl border bg-white p-5"><h3 className="font-semibold">งานนำเข้าล่าสุด</h3><div className="mt-3 divide-y">{jobs.map((job) => <Link key={job.id} href={`${base}/${job.id}`} className="flex flex-col gap-2 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{job.fileName}</p><p className="text-xs text-slate-500">{job.createdAt.toLocaleString("th-TH")} · {job.totalRows} แถว · ผ่าน {job.importedRows} · มีปัญหา {job.failedRows}</p></div><Badge variant={job.stage === PopulationImportStage.COMPLETED ? "success" : job.stage === PopulationImportStage.FAILED ? "danger" : "warning"}>{job.stage}</Badge></Link>)}{!jobs.length ? <p className="py-8 text-center text-sm text-slate-500">ยังไม่มีงานนำเข้า</p> : null}</div></section>
    <section className="rounded-xl border bg-white p-5"><h3 className="font-semibold">รูปแบบไฟล์ที่รองรับ</h3><p className="mt-2 text-sm text-slate-500">Excel/CSV · {POPULATION_IMPORT_COLUMNS.length} คอลัมน์มาตรฐาน โดย house_number, first_name และ last_name เป็นข้อมูลหลัก</p></section>
  </div>;
}
