import Link from "next/link";
import { PopulationImportStage } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { POPULATION_IMPORT_COLUMNS } from "@/features/population/server/import-template";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { getWorkspaceVillage } from "@/features/village-workspace/server/queries";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { WorkspacePopulationImportForm } from "./workspace-import-form";

function importStageLabel(stage: PopulationImportStage) {
  return ({
    PENDING: "รอตรวจสอบก่อนนำเข้า",
    PROCESSING: "กำลังนำเข้าข้อมูล",
    COMPLETED: "นำเข้าสำเร็จ",
    PARTIAL: "นำเข้าได้บางส่วน",
    FAILED: "นำเข้าไม่สำเร็จ",
  } as Record<PopulationImportStage, string>)[stage];
}

function importStageVariant(stage: PopulationImportStage) {
  if (stage === PopulationImportStage.COMPLETED) return "success" as const;
  if (stage === PopulationImportStage.FAILED) return "danger" as const;
  return "warning" as const;
}

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
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 sm:p-5"><div className="flex items-baseline justify-between gap-3"><h3 className="text-base font-semibold text-slate-900">งานนำเข้าล่าสุด</h3>{jobs.length ? <p className="text-xs text-slate-500">เลือกงานเพื่อดูรายละเอียด</p> : null}</div><div className="mt-3 grid gap-2">{jobs.map((job) => <Link key={job.id} href={`${base}/${job.id}`} className="group rounded-xl bg-slate-50/80 px-3.5 py-3 transition hover:bg-emerald-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900 group-hover:text-emerald-900">{job.fileName}</p><p className="mt-1 text-xs text-slate-500">{job.createdAt.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}</p></div><Badge variant={importStageVariant(job.stage)}>{importStageLabel(job.stage)}</Badge></div><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600"><span>ทั้งหมด {job.totalRows.toLocaleString("th-TH")} แถว</span><span>นำเข้า {job.importedRows.toLocaleString("th-TH")}</span><span className={job.failedRows > 0 ? "text-amber-700" : undefined}>ต้องตรวจสอบ {job.failedRows.toLocaleString("th-TH")}</span></div></Link>)}{!jobs.length ? <p className="py-8 text-center text-sm text-slate-500">ยังไม่มีงานนำเข้า</p> : null}</div></section>
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><h3 className="font-semibold text-gray-900">รูปแบบไฟล์ที่รองรับ</h3><p className="mt-2 text-sm text-gray-600">Excel/CSV · {POPULATION_IMPORT_COLUMNS.length} คอลัมน์มาตรฐาน โดย house_number, first_name และ last_name เป็นข้อมูลหลัก</p></section>
  </div>;
}
