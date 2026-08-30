import Link from "next/link";
import { PopulationImportStage } from "@prisma/client";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { ImportJobActions } from "@/app/(admin)/admin/population/import/[jobId]/import-confirm-form";
import { getImportCleanupPreflightAction } from "@/app/(admin)/admin/population/import/[jobId]/actions";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";

type RowDetail = { rowNumber: number; action?: string; status?: string; errorMessage?: string | null; note?: string | null };
type DetailPayload = { rowDetails?: RowDetail[]; cleanupHistory?: Array<{ cleanedAt: string; deletedPeople: number; deletedHouses: number; skippedCount: number }> };

function stageInfo(stage: PopulationImportStage) {
  return ({
    PENDING: { label: "รอตรวจสอบก่อนนำเข้า", variant: "warning" as const },
    PROCESSING: { label: "กำลังนำเข้าข้อมูล", variant: "warning" as const },
    COMPLETED: { label: "นำเข้าข้อมูลเรียบร้อย", variant: "success" as const },
    PARTIAL: { label: "นำเข้าข้อมูลได้บางส่วน", variant: "warning" as const },
    FAILED: { label: "ไม่สามารถนำเข้าข้อมูล", variant: "danger" as const },
  })[stage];
}

function rowLabel(action?: string) {
  return ({ CREATE: "สร้างใหม่", UPDATE: "อัปเดตข้อมูล", CONFLICT: "ต้องตรวจสอบ", FAILED: "ไม่สามารถนำเข้า", SKIP: "ข้าม" } as Record<string, string>)[action ?? ""] ?? "รอตรวจสอบ";
}

function rowTone(action?: string) {
  return action === "CREATE" ? "text-green-700" : action === "UPDATE" ? "text-blue-700" : action === "CONFLICT" || action === "SKIP" ? "text-amber-700" : action === "FAILED" ? "text-red-700" : "text-gray-600";
}

export default async function Page({ params }: { params: Promise<{ villageId: string; jobId: string }> }) {
  await requireSuperAdminPageSession();
  const { villageId, jobId } = await params;
  const job = await prisma.populationImportJob.findFirst({ where: { id: jobId, villageId } });
  if (!job) notFound();

  const payload = (job.errors && typeof job.errors === "object" && !Array.isArray(job.errors) ? job.errors : {}) as DetailPayload;
  const rows = payload.rowDetails ?? [];
  const validRows = rows.filter((row) => row.action === "CREATE" || row.action === "UPDATE");
  const warningRows = rows.filter((row) => row.action === "CONFLICT" || row.action === "SKIP");
  const invalidRows = rows.filter((row) => row.action === "FAILED");
  const isPreview = job.stage === PopulationImportStage.PENDING;
  const isFinished = job.stage === PopulationImportStage.COMPLETED || job.stage === PopulationImportStage.PARTIAL;
  const cleanupPreflight = isFinished ? await getImportCleanupPreflightAction(jobId, villageId) : null;
  const canRollback = isFinished && ((cleanupPreflight?.deletablePeople ?? 0) + (cleanupPreflight?.deletableHouses ?? 0) > 0);
  const base = `/superadmin/villages/${villageId}/population/import`;
  const stage = stageInfo(job.stage);

  return <div className="space-y-5 pb-6">
    <SuperAdminPageHeaderRegistration priority={1} context={{ title: "รายละเอียดชุดข้อมูลนำเข้า", description: job.fileName }} />
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href={base} className="inline-flex min-h-10 items-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">กลับประวัติการนำเข้า</Link><Badge variant={stage.variant}>{stage.label}</Badge></div>

    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="break-all text-base font-semibold text-gray-900">{job.fileName}</h2><p className="mt-1 text-sm text-gray-500">สร้างเมื่อ {job.createdAt.toLocaleString("th-TH")}</p></div><p className="text-sm text-gray-500">แหล่งข้อมูล: ไฟล์ที่อัปโหลด</p></div><div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 text-sm sm:grid-cols-4"><p>ทั้งหมด <strong className="block text-lg text-gray-900">{job.totalRows.toLocaleString("th-TH")}</strong></p><p>สร้างใหม่ <strong className="block text-lg text-green-700">{job.createdRows.toLocaleString("th-TH")}</strong></p><p>อัปเดต <strong className="block text-lg text-blue-700">{job.updatedRows.toLocaleString("th-TH")}</strong></p><p>นำเข้าแล้ว <strong className="block text-lg text-gray-900">{job.importedRows.toLocaleString("th-TH")}</strong></p><p>ต้องตรวจสอบ <strong className="block text-lg text-amber-700">{job.conflictRows.toLocaleString("th-TH")}</strong></p><p>ข้าม <strong className="block text-lg text-gray-900">{job.skippedRows.toLocaleString("th-TH")}</strong></p><p>ไม่สำเร็จ <strong className="block text-lg text-red-700">{job.failedRows.toLocaleString("th-TH")}</strong></p></div></section>

    <section className="rounded-xl border border-gray-200 bg-white"><div className="border-b border-gray-100 px-4 py-4 sm:px-5"><h2 className="text-base font-semibold text-gray-900">ผลการตรวจสอบ</h2><p className="mt-1 text-sm text-gray-500">แยกผลตามรายการที่พร้อมดำเนินการ รายการเตือน และรายการที่ต้องแก้ไข</p></div><div className="grid gap-3 p-4 sm:grid-cols-3"><article className="rounded-lg bg-green-50 p-3 text-sm text-green-950"><p className="font-medium">พร้อมนำเข้า</p><p className="mt-1 text-2xl font-semibold">{(validRows.length || job.createdRows + job.updatedRows).toLocaleString("th-TH")}</p></article><article className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950"><p className="font-medium">คำเตือน/ต้องตรวจสอบ</p><p className="mt-1 text-2xl font-semibold">{(warningRows.length || job.conflictRows + job.skippedRows).toLocaleString("th-TH")}</p></article><article className="rounded-lg bg-red-50 p-3 text-sm text-red-950"><p className="font-medium">ไม่สามารถนำเข้า</p><p className="mt-1 text-2xl font-semibold">{(invalidRows.length || job.failedRows).toLocaleString("th-TH")}</p></article></div>{rows.length ? <div className="max-h-[34rem] divide-y divide-gray-100 overflow-y-auto border-t border-gray-100">{rows.slice(0, 200).map((row, index) => <article key={`${row.rowNumber}-${index}`} className="px-4 py-3 sm:px-5"><div className="flex flex-wrap items-center justify-between gap-2 text-sm"><p className="font-medium text-gray-900">แถว {row.rowNumber}</p><p className={`font-medium ${rowTone(row.action)}`}>{rowLabel(row.action)}</p></div><p className="mt-1 text-sm leading-5 text-gray-600">{row.errorMessage || row.note || (row.action === "CREATE" ? "พร้อมสร้างข้อมูลใหม่" : row.action === "UPDATE" ? "พบข้อมูลเดิมและจะปรับปรุงข้อมูล" : "โปรดตรวจสอบข้อมูลในแถวนี้")}</p></article>)}</div> : <p className="p-6 text-center text-sm text-gray-500">ไม่มีรายละเอียดรายแถวเพิ่มเติมสำหรับชุดข้อมูลนี้</p>}</section>

    {isPreview ? <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5"><h2 className="text-base font-semibold text-amber-950">ยืนยันการนำเข้า</h2><p className="mt-1 text-sm leading-5 text-amber-900">ข้อมูลจะถูกบันทึกในทะเบียนประชากรหลังยืนยันเท่านั้น รายการที่มีปัญหาจะไม่ถูกนำเข้า</p><div className="mt-4"><ImportJobActions jobId={jobId} targetVillageId={villageId} fileName={job.fileName} createdRows={job.createdRows} updatedRows={job.updatedRows} conflictRows={job.conflictRows} failedRows={job.failedRows} cleanupPeopleCount={0} cleanupHousesCount={0} canConfirm canCleanup={false} /></div></section> : null}

    {isFinished ? <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><h2 className="text-base font-semibold text-gray-900">การย้อนกลับการนำเข้า</h2><p className="mt-1 max-w-3xl text-sm leading-5 text-gray-600">ระบบจะย้อนกลับได้เฉพาะข้อมูลที่ชุดนี้สร้างใหม่และยังไม่เชื่อมโยงหรือเปลี่ยนแปลงภายหลัง ข้อมูลเดิมที่ถูกอัปเดตจะไม่ถูกคืนค่าอัตโนมัติ</p>{cleanupPreflight ? <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><p className="rounded-lg bg-slate-50 p-3">ย้อนกลับได้: บุคคล {cleanupPreflight.deletablePeople.toLocaleString("th-TH")} รายการ · บ้าน {cleanupPreflight.deletableHouses.toLocaleString("th-TH")} หลัง</p><p className="rounded-lg bg-slate-50 p-3">ย้อนกลับไม่ได้: {cleanupPreflight.skipped.length.toLocaleString("th-TH")} รายการ {canRollback ? "เนื่องจากมีความเกี่ยวข้องหรือถูกแก้ไขแล้ว" : "ไม่มีรายการที่ปลอดภัยต่อการย้อนกลับ"}</p></div> : null}{canRollback ? <div className="mt-4"><ImportJobActions jobId={jobId} targetVillageId={villageId} fileName={job.fileName} createdRows={job.createdRows} updatedRows={job.updatedRows} conflictRows={job.conflictRows} failedRows={job.failedRows} cleanupPeopleCount={0} cleanupHousesCount={0} cleanupPreflight={cleanupPreflight} canConfirm={false} canCleanup /></div> : null}{payload.cleanupHistory?.length ? <p className="mt-3 text-sm text-gray-500">มีประวัติการย้อนกลับแล้ว {payload.cleanupHistory.length.toLocaleString("th-TH")} ครั้ง</p> : null}</section> : null}
  </div>;
}
