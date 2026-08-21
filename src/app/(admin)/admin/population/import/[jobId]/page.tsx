import { MembershipStatus, PopulationImportStage, VillageMembershipRole } from "@prisma/client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { computeLandingPath, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { ImportJobActions } from "./import-confirm-form";

const ADMIN_MEMBERSHIP_ROLES = new Set<VillageMembershipRole>([VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN, VillageMembershipRole.COMMITTEE]);

type RowDetail = { rowNumber: number; action: string; status: string; errorCode?: string | null; errorMessage?: string | null; confidenceLevel?: string; matchedRecordId?: string | null };
type ImportJobDetailsPayload = { errors?: string[]; sourceHeaders?: string[]; previewRows?: Array<Record<string, string>>; createdPersonIds?: string[]; createdHouseIds?: string[]; rowDetails?: RowDetail[] };
type StoredPreviewRow = { rowNumber?: number; houseNumber?: string | null; firstName?: string | null; lastName?: string | null; action?: string; note?: string | null };

function parsePayload(value: unknown): ImportJobDetailsPayload { return value && typeof value === "object" && !Array.isArray(value) ? value as ImportJobDetailsPayload : Array.isArray(value) ? { errors: value.map(String) } : {}; }
function stageLabel(stage: PopulationImportStage) { return ({ PENDING: "รอตรวจสอบและยืนยัน", PROCESSING: "กำลังนำเข้าข้อมูล", COMPLETED: "นำเข้าสำเร็จ", PARTIAL: "นำเข้าสำเร็จบางส่วน", FAILED: "ไม่สามารถนำเข้า" } as const)[stage]; }
function actionLabel(action?: string) { return ({ CREATE: "สร้างใหม่", UPDATE: "อัปเดตข้อมูล", CONFLICT: "ต้องตรวจสอบ", FAILED: "ไม่สามารถนำเข้า", SKIP: "ข้าม" } as Record<string, string>)[action ?? ""] ?? "รอตรวจสอบ"; }
function actionTone(action?: string) { return action === "CREATE" ? "text-green-700" : action === "UPDATE" ? "text-blue-700" : action === "CONFLICT" ? "text-amber-700" : action === "FAILED" ? "text-red-700" : "text-gray-600"; }
function rowMessage(detail?: RowDetail, fallback?: string) {
  if (!detail?.errorMessage) return fallback ?? (detail?.action === "UPDATE" ? "พบข้อมูลเดิมที่ตรงกัน ระบบจะอัปเดตข้อมูล" : detail?.action === "CREATE" ? "พร้อมสร้างข้อมูลใหม่" : "พร้อมตรวจสอบ");
  if (detail.errorCode === "DUPLICATE_IN_FILE") return "พบข้อมูลบุคคลซ้ำภายในไฟล์เดียวกัน";
  if (detail.errorCode === "IDENTIFIER_CONFLICT" || detail.errorCode === "IDENTITY_MATCH_CONFLICT") return "เลขบัตรประชาชนและเบอร์โทรศัพท์อ้างถึงคนละบุคคล";
  if (/national_id/i.test(detail.errorMessage)) return "เลขบัตรประชาชนไม่ถูกต้อง";
  if (/first_name|last_name/i.test(detail.errorMessage)) return "ชื่อและนามสกุลไม่ครบ";
  if (/person_status/i.test(detail.errorMessage)) return "สถานะบุคคลไม่ถูกต้อง";
  return detail.errorMessage;
}
function resultTitle(stage: PopulationImportStage) { return stage === PopulationImportStage.COMPLETED ? "นำเข้าสำเร็จ" : stage === PopulationImportStage.PARTIAL ? "นำเข้าสำเร็จบางส่วน" : stage === PopulationImportStage.FAILED ? "ไม่สามารถนำเข้าข้อมูล" : "สถานะงานนำเข้า"; }

interface PageProps { params: Promise<{ jobId: string }> }

export default async function Page({ params }: PageProps) {
  const { jobId } = await params;
  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/admin/population/import");
  if (!isAdminUser(session)) redirect(computeLandingPath(session));
  const adminMembership = session.memberships.find((membership) => membership.status === MembershipStatus.ACTIVE && ADMIN_MEMBERSHIP_ROLES.has(membership.role));
  if (!adminMembership) redirect(computeLandingPath(session));

  const job = await prisma.populationImportJob.findFirst({
    where: { id: jobId, villageId: adminMembership.villageId },
    select: { id: true, fileName: true, stage: true, totalRows: true, importedRows: true, failedRows: true, errors: true, sourceRows: true, createdAt: true, startedAt: true, completedAt: true, createdRows: true, updatedRows: true, skippedRows: true, conflictRows: true, village: { select: { name: true } } },
  });
  if (!job) notFound();

  const payload = parsePayload(job.errors);
  const errors = payload.errors ?? [];
  const sourceHeaders = payload.sourceHeaders ?? [];
  const previewRows = payload.previewRows ?? [];
  const rowDetails = payload.rowDetails ?? [];
  const createdPersonIds = payload.createdPersonIds ?? [];
  const createdHouseIds = payload.createdHouseIds ?? [];
  const sourceRows = Array.isArray(job.sourceRows) ? job.sourceRows as unknown as StoredPreviewRow[] : [];
  const sourceRowsByNumber = new Map(sourceRows.filter((row) => typeof row.rowNumber === "number").map((row) => [row.rowNumber!, row]));
  const reviewRows = rowDetails.length > 0
    ? rowDetails.map((detail, index) => ({ detail, row: sourceRowsByNumber.get(detail.rowNumber), fallback: previewRows[index], rowNumber: detail.rowNumber }))
    : previewRows.map((row, index) => ({ detail: undefined, row: sourceRows[index], fallback: row, rowNumber: index + 2 }));

  const [createdPeople, createdHouses] = await Promise.all([
    createdPersonIds.length ? prisma.person.findMany({ where: { id: { in: createdPersonIds }, villageId: adminMembership.villageId }, select: { id: true, firstName: true, lastName: true, house: { select: { houseNumber: true } } }, orderBy: [{ updatedAt: "desc" }] }) : [],
    createdHouseIds.length ? prisma.house.findMany({ where: { id: { in: createdHouseIds }, villageId: adminMembership.villageId }, select: { id: true, houseNumber: true }, orderBy: { houseNumber: "asc" } }) : [],
  ]);

  const isPreview = job.stage === PopulationImportStage.PENDING;
  const isCompleted = job.stage === PopulationImportStage.COMPLETED || job.stage === PopulationImportStage.PARTIAL;
  const invalidRows = Math.max(job.failedRows - job.conflictRows, 0);
  const hasIssues = job.failedRows > 0 || job.conflictRows > 0 || errors.length > 0;
  const canCleanup = isCompleted && (createdPeople.length > 0 || createdHouses.length > 0);

  return <div data-admin-compact-top className="space-y-4">
    <AdminPageToolbar title="รายละเอียดงานนำเข้า" description={`${job.fileName} · ${job.village.name}`} actions={<div className="flex flex-wrap gap-2"><Link href="/admin/population/import" className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">กลับหน้านำเข้า</Link>{hasIssues ? <a href={`/api/admin/population/import/${job.id}/error-report`} download className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">ดาวน์โหลดรายงานข้อผิดพลาด</a> : null}</div>} />

    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h1 className="break-words text-lg font-semibold text-gray-900">{isPreview ? "ตรวจสอบข้อมูลก่อนนำเข้า" : resultTitle(job.stage)}</h1><p className="mt-1 break-words text-sm text-gray-500">ไฟล์ {job.fileName}</p></div><span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700">{stageLabel(job.stage)}</span></div>
      <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 text-sm sm:grid-cols-3"><div><p className="text-xs text-gray-500">ไฟล์</p><p className="mt-1 break-words font-medium text-gray-900">{job.fileName}</p></div><div><p className="text-xs text-gray-500">สร้างงานเมื่อ</p><p className="mt-1 font-medium text-gray-900">{job.createdAt.toLocaleString("th-TH")}</p></div><div><p className="text-xs text-gray-500">สถานะ</p><p className="mt-1 font-medium text-gray-900">{stageLabel(job.stage)}</p></div></div>
    </section>

    {isPreview ? <>
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><h2 className="text-base font-semibold text-gray-900">สรุปผลตรวจสอบ</h2><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm"><span>สร้างใหม่ <strong className="text-gray-900">{job.createdRows.toLocaleString("th-TH")}</strong></span><span>อัปเดตข้อมูล <strong className="text-gray-900">{job.updatedRows.toLocaleString("th-TH")}</strong></span><span className={job.conflictRows > 0 ? "text-amber-700" : ""}>ต้องตรวจสอบ <strong>{job.conflictRows.toLocaleString("th-TH")}</strong></span><span className={invalidRows > 0 ? "text-red-700" : ""}>ไม่สามารถนำเข้า <strong>{invalidRows.toLocaleString("th-TH")}</strong></span></div></section>
      <section className="rounded-xl border border-gray-200 bg-white"><div className="border-b border-gray-100 px-4 py-4 sm:px-5"><h2 className="text-base font-semibold text-gray-900">รายการที่จะนำเข้า</h2><p className="mt-1 text-sm text-gray-500">แสดงผลตรวจสอบของแต่ละแถว เพื่อให้ตรวจสอบก่อนยืนยัน</p></div>{reviewRows.length === 0 ? <p className="px-4 py-6 text-sm text-gray-500">ไม่พบรายละเอียดแถวสำหรับงานนี้ อาจเป็นงานจากเวอร์ชันก่อนหน้า</p> : <div className="divide-y divide-gray-100">{reviewRows.slice(0, 100).map((item, index) => { const row = item.row; const fallback = item.fallback; const rowNumber = item.detail?.rowNumber ?? item.rowNumber ?? index + 2; const house = row?.houseNumber ?? fallback?.house_number ?? "-"; const name = [row?.firstName ?? fallback?.first_name, row?.lastName ?? fallback?.last_name].filter(Boolean).join(" ") || "ไม่มีข้อมูลบุคคล"; const action = item.detail?.action ?? row?.action; return <article key={`${rowNumber}-${index}`} className="px-4 py-3 sm:px-5"><div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4"><p className="text-sm text-gray-700"><span className="font-medium text-gray-900">แถว {rowNumber}</span><span className="text-gray-400"> · </span>บ้าน {house}<span className="text-gray-400"> · </span>{name}</p><span className={`text-sm font-medium ${actionTone(action)}`}>{actionLabel(action)}</span></div><p className="mt-1 text-sm leading-5 text-gray-500">{rowMessage(item.detail, row?.note ?? fallback?.note)}</p></article>; })}</div>}</section>
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><h2 className="text-base font-semibold text-gray-900">ยืนยันนำเข้าข้อมูล</h2><p className="mt-1 text-sm leading-5 text-gray-500">ข้อมูลจะยังไม่ถูกบันทึกจริงจนกว่าจะยืนยัน รายการที่ต้องตรวจสอบหรือไม่สามารถนำเข้าจะไม่ถูกบันทึก</p><div className="mt-4"><ImportJobActions jobId={job.id} createdRows={job.createdRows} updatedRows={job.updatedRows} conflictRows={job.conflictRows} failedRows={invalidRows} cleanupPeopleCount={0} cleanupHousesCount={0} canConfirm canCleanup={false} /></div></section>
    </> : <>
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><h2 className="text-base font-semibold text-gray-900">ผลการนำเข้าข้อมูล</h2><div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6"><div><p className="text-xs text-gray-500">ทั้งหมด</p><p className="mt-1 text-lg font-semibold text-gray-900">{job.totalRows.toLocaleString("th-TH")}</p></div><div><p className="text-xs text-gray-500">สำเร็จ</p><p className="mt-1 text-lg font-semibold text-green-700">{job.importedRows.toLocaleString("th-TH")}</p></div><div><p className="text-xs text-gray-500">ไม่สำเร็จ</p><p className="mt-1 text-lg font-semibold text-red-700">{job.failedRows.toLocaleString("th-TH")}</p></div><div><p className="text-xs text-gray-500">สร้างใหม่</p><p className="mt-1 text-lg font-semibold text-gray-900">{job.createdRows.toLocaleString("th-TH")}</p></div><div><p className="text-xs text-gray-500">อัปเดตข้อมูล</p><p className="mt-1 text-lg font-semibold text-gray-900">{job.updatedRows.toLocaleString("th-TH")}</p></div>{job.skippedRows > 0 ? <div><p className="text-xs text-gray-500">ข้าม</p><p className="mt-1 text-lg font-semibold text-gray-900">{job.skippedRows.toLocaleString("th-TH")}</p></div> : null}</div></section>
      {isCompleted ? <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><h2 className="text-base font-semibold text-gray-900">ข้อมูลที่เกี่ยวข้องกับงานนี้</h2>{createdPeople.length === 0 && createdHouses.length === 0 ? <p className="mt-3 text-sm text-gray-500">ไม่พบข้อมูลที่ติดตามได้ว่าเป็นรายการที่สร้างใหม่จากงานนี้</p> : <div className="mt-3 grid gap-3 md:grid-cols-2">{createdPeople.map((person) => <div key={person.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2.5"><p className="min-w-0 text-sm text-gray-700"><span className="font-medium text-gray-900">{person.firstName} {person.lastName}</span> · บ้าน {person.house?.houseNumber ?? "-"}</p><Link href={`/admin/population/people/${person.id}`} className="shrink-0 text-sm font-medium text-green-700 hover:underline">ดูข้อมูล</Link></div>)}{createdHouses.map((house) => <div key={house.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2.5"><p className="text-sm font-medium text-gray-900">บ้าน {house.houseNumber}</p><Link href={`/admin/population/houses/${house.id}`} className="shrink-0 text-sm font-medium text-green-700 hover:underline">ดูข้อมูลบ้าน</Link></div>)}</div>}</section> : null}
      {hasIssues ? <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><h2 className="text-base font-semibold text-gray-900">รายการที่ต้องตรวจสอบ</h2><p className="mt-1 text-sm text-gray-500">ดาวน์โหลดรายงานข้อผิดพลาดเพื่อดูรายละเอียดเพิ่มเติม</p>{rowDetails.filter((row) => row.action === "CONFLICT" || row.action === "FAILED").length > 0 ? <ul className="mt-3 divide-y divide-gray-100">{rowDetails.filter((row) => row.action === "CONFLICT" || row.action === "FAILED").slice(0, 20).map((row) => <li key={row.rowNumber} className="py-2 text-sm"><span className={`font-medium ${actionTone(row.action)}`}>แถว {row.rowNumber} · {actionLabel(row.action)}</span><p className="mt-1 text-gray-600">{rowMessage(row)}</p></li>)}</ul> : null}</section> : null}
      {isCompleted && canCleanup ? <section className="border-t border-gray-200 pt-5"><h2 className="text-sm font-semibold text-gray-900">จัดการข้อมูลที่สร้างจากงานนี้</h2><p className="mt-1 max-w-2xl text-sm leading-5 text-gray-500">ลบได้เฉพาะข้อมูลที่ระบบติดตามว่าเป็นรายการสร้างใหม่ ข้อมูลเดิมที่ถูกอัปเดตจะไม่กลับเป็นค่าเดิมโดยอัตโนมัติ</p><div className="mt-3"><ImportJobActions jobId={job.id} createdRows={job.createdRows} updatedRows={job.updatedRows} conflictRows={job.conflictRows} failedRows={job.failedRows} cleanupPeopleCount={createdPeople.length} cleanupHousesCount={createdHouses.length} canConfirm={false} canCleanup /></div></section> : null}
    </>}

    <details className="rounded-xl border border-gray-200 bg-white"><summary className="cursor-pointer px-4 py-3.5 text-sm font-semibold text-gray-900 marker:text-gray-500">รายละเอียดไฟล์</summary><div className="border-t border-gray-100 px-4 py-4 text-sm text-gray-600 sm:px-5"><dl className="grid gap-3 sm:grid-cols-2"><div><dt className="text-xs text-gray-500">ไฟล์ต้นฉบับ</dt><dd className="mt-1 break-words font-medium text-gray-900">{job.fileName}</dd></div><div><dt className="text-xs text-gray-500">สร้างงานเมื่อ</dt><dd className="mt-1 font-medium text-gray-900">{job.createdAt.toLocaleString("th-TH")}</dd></div><div><dt className="text-xs text-gray-500">เริ่มประมวลผล</dt><dd className="mt-1 font-medium text-gray-900">{job.startedAt ? job.startedAt.toLocaleString("th-TH") : "-"}</dd></div><div><dt className="text-xs text-gray-500">เสร็จสิ้น</dt><dd className="mt-1 font-medium text-gray-900">{job.completedAt ? job.completedAt.toLocaleString("th-TH") : "-"}</dd></div></dl><div className="mt-4 border-t border-gray-100 pt-3"><p className="text-xs text-gray-500">หัวคอลัมน์จากไฟล์</p>{sourceHeaders.length ? <p className="mt-1 leading-6 text-gray-700">{sourceHeaders.join(", ")}</p> : <p className="mt-1 text-gray-500">ไม่พบรายละเอียดหัวคอลัมน์สำหรับงานนี้</p>}</div></div></details>
  </div>;
}
