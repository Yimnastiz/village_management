import { MembershipStatus, PopulationImportStage, VillageMembershipRole } from "@prisma/client";
import { CheckCircle2, CircleAlert, Clock3, LoaderCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { POPULATION_IMPORT_HEADER_ALIASES } from "@/features/population/server/import-template";
import { computeLandingPath, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { ImportJobActions } from "./import-confirm-form";

const ADMIN_MEMBERSHIP_ROLES = new Set<VillageMembershipRole>([VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN, VillageMembershipRole.COMMITTEE]);
type RowDetail = { rowNumber: number; action: string; status: string; errorCode?: string | null; errorMessage?: string | null; confidenceLevel?: string; matchedRecordId?: string | null };
type ImportJobDetailsPayload = { errors?: string[]; sourceHeaders?: string[]; previewRows?: Array<Record<string, string>>; createdPersonIds?: string[]; createdHouseIds?: string[]; rowDetails?: RowDetail[] };
type StoredPreviewRow = { rowNumber?: number; houseNumber?: string | null; firstName?: string | null; lastName?: string | null; action?: string; note?: string | null };

const COLUMN_GROUPS = [
  { title: "ข้อมูลบ้าน", keys: ["house_number", "house_address", "zone_name", "occupancy_status", "latitude", "longitude"], labels: { house_number: "เลขที่บ้าน", house_address: "รายละเอียดที่อยู่", zone_name: "เขต/โซน", occupancy_status: "สถานะบ้าน", latitude: "พิกัดละติจูด", longitude: "พิกัดลองจิจูด" } },
  { title: "ข้อมูลบุคคล", keys: ["first_name", "last_name", "national_id", "phone_number", "date_of_birth", "gender", "email", "person_status", "external_person_id"], labels: { first_name: "ชื่อ", last_name: "นามสกุล", national_id: "เลขบัตรประชาชน", phone_number: "เบอร์โทรศัพท์", date_of_birth: "วันเกิด", gender: "เพศ", email: "อีเมล", person_status: "สถานะบุคคล", external_person_id: "รหัสอ้างอิง" } },
  { title: "ข้อมูลเหตุการณ์ประชากร", keys: ["movement_type", "movement_date"], labels: { movement_type: "เหตุการณ์ประชากร", movement_date: "วันที่เกิดเหตุการณ์" } },
] as const;

function parsePayload(value: unknown): ImportJobDetailsPayload { return value && typeof value === "object" && !Array.isArray(value) ? value as ImportJobDetailsPayload : Array.isArray(value) ? { errors: value.map(String) } : {}; }
function stageLabel(stage: PopulationImportStage) { return ({ PENDING: "รอตรวจสอบก่อนนำเข้า", PROCESSING: "กำลังนำเข้าข้อมูล", COMPLETED: "นำเข้าข้อมูลเรียบร้อยแล้ว", PARTIAL: "นำเข้าข้อมูลได้บางส่วน", FAILED: "ไม่สามารถนำเข้าข้อมูล" } as const)[stage]; }
function actionLabel(action?: string) { return ({ CREATE: "สร้างใหม่", UPDATE: "อัปเดตข้อมูล", CONFLICT: "ต้องตรวจสอบ", FAILED: "ไม่สามารถนำเข้า", SKIP: "ข้าม" } as Record<string, string>)[action ?? ""] ?? "รอตรวจสอบ"; }
function actionTone(action?: string) { return action === "CREATE" ? "text-green-700" : action === "UPDATE" ? "text-blue-700" : action === "CONFLICT" ? "text-amber-700" : action === "FAILED" ? "text-red-700" : "text-gray-600"; }
function rowMessage(detail?: RowDetail, fallback?: string) {
  if (!detail?.errorMessage) return fallback ?? (detail?.action === "UPDATE" ? "พบข้อมูลบุคคลเดิมที่ตรงกัน ระบบจะปรับปรุงข้อมูลเดิม" : detail?.action === "CREATE" ? "พร้อมสร้างข้อมูลใหม่" : "พร้อมตรวจสอบ");
  if (detail.errorCode === "DUPLICATE_IN_FILE") return "พบข้อมูลบุคคลซ้ำภายในไฟล์เดียวกัน";
  if (detail.errorCode === "IDENTIFIER_CONFLICT" || detail.errorCode === "IDENTITY_MATCH_CONFLICT") return "เลขบัตรประชาชนและเบอร์โทรศัพท์อ้างถึงคนละบุคคล";
  if (/national_id/i.test(detail.errorMessage)) return "เลขบัตรประชาชนไม่ถูกต้อง";
  if (/first_name|last_name/i.test(detail.errorMessage)) return "ชื่อและนามสกุลไม่ครบ";
  if (/person_status/i.test(detail.errorMessage)) return "สถานะบุคคลไม่ถูกต้อง";
  return detail.errorMessage;
}
function statusPresentation(stage: PopulationImportStage) {
  if (stage === PopulationImportStage.COMPLETED) return { title: "นำเข้าข้อมูลเรียบร้อยแล้ว", Icon: CheckCircle2, tone: "text-green-700" };
  if (stage === PopulationImportStage.PARTIAL) return { title: "นำเข้าข้อมูลได้บางส่วน", Icon: CircleAlert, tone: "text-amber-700" };
  if (stage === PopulationImportStage.FAILED) return { title: "ไม่สามารถนำเข้าข้อมูล", Icon: XCircle, tone: "text-red-700" };
  if (stage === PopulationImportStage.PROCESSING) return { title: "กำลังนำเข้าข้อมูล", Icon: LoaderCircle, tone: "text-blue-700" };
  return { title: "รอตรวจสอบก่อนนำเข้า", Icon: Clock3, tone: "text-amber-700" };
}
function formatDateTime(value: Date) { return value.toLocaleString("th-TH", { dateStyle: "long", timeStyle: "short" }); }
function headerKey(header: string) { return header.normalize("NFKC").trim().toLowerCase().replace(/[\s_\-./()]+/g, "").replace(/[:;]/g, ""); }
function canonicalHeader(header: string) {
  const normalized = headerKey(header);
  return Object.entries(POPULATION_IMPORT_HEADER_ALIASES).find(([, aliases]) => aliases.some((alias) => headerKey(alias) === normalized))?.[0];
}

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
    select: { id: true, fileName: true, stage: true, totalRows: true, importedRows: true, failedRows: true, errors: true, sourceRows: true, createdAt: true, startedAt: true, completedAt: true, createdRows: true, updatedRows: true, skippedRows: true, conflictRows: true },
  });
  if (!job) notFound();

  const payload = parsePayload(job.errors);
  const errors = payload.errors ?? []; const sourceHeaders = payload.sourceHeaders ?? []; const previewRows = payload.previewRows ?? [];
  const rowDetails = payload.rowDetails ?? []; const createdPersonIds = payload.createdPersonIds ?? []; const createdHouseIds = payload.createdHouseIds ?? [];
  const sourceRows = Array.isArray(job.sourceRows) ? job.sourceRows as unknown as StoredPreviewRow[] : [];
  const sourceRowsByNumber = new Map(sourceRows.filter((row) => typeof row.rowNumber === "number").map((row) => [row.rowNumber!, row]));
  const reviewRows = rowDetails.length > 0 ? rowDetails.map((detail, index) => ({ detail, row: sourceRowsByNumber.get(detail.rowNumber), fallback: previewRows[index], rowNumber: detail.rowNumber })) : previewRows.map((row, index) => ({ detail: undefined, row: sourceRows[index], fallback: row, rowNumber: index + 2 }));
  const [createdPeople, createdHouses] = await Promise.all([
    createdPersonIds.length ? prisma.person.findMany({ where: { id: { in: createdPersonIds }, villageId: adminMembership.villageId }, select: { id: true, firstName: true, lastName: true, house: { select: { houseNumber: true } } }, orderBy: [{ updatedAt: "desc" }] }) : [],
    createdHouseIds.length ? prisma.house.findMany({ where: { id: { in: createdHouseIds }, villageId: adminMembership.villageId }, select: { id: true, houseNumber: true }, orderBy: { houseNumber: "asc" } }) : [],
  ]);
  const isPreview = job.stage === PopulationImportStage.PENDING;
  const isCompleted = job.stage === PopulationImportStage.COMPLETED || job.stage === PopulationImportStage.PARTIAL;
  const invalidRows = Math.max(job.failedRows - job.conflictRows, 0);
  const hasIssues = job.failedRows > 0 || job.conflictRows > 0 || errors.length > 0;
  const canCleanup = isCompleted && (createdPeople.length > 0 || createdHouses.length > 0);
  const status = statusPresentation(job.stage);
  const unknownHeaders = sourceHeaders.filter((header) => !canonicalHeader(header));

  return <div data-admin-compact-top className="space-y-4">
    <AdminPageToolbar sticky hideHeading variant="detail" title="รายละเอียดงานนำเข้า" description="ตรวจสอบผลและข้อมูลของงานนำเข้า" actions={<div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="truncate text-sm font-medium text-gray-700" title={job.fileName}>{job.fileName}</p><div className="flex shrink-0 flex-wrap gap-2"><Link href="/admin/population/import" className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">กลับหน้านำเข้า</Link>{hasIssues ? <a href={`/api/admin/population/import/${job.id}/error-report`} download className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">ดาวน์โหลดรายงานข้อผิดพลาด</a> : null}</div></div>} />

    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><div className="flex items-start gap-3"><status.Icon className={`mt-0.5 h-5 w-5 shrink-0 ${status.tone}`} aria-hidden="true" /><div><h1 className="text-base font-semibold text-gray-900">{status.title}</h1>{job.completedAt ? <p className="mt-1 text-sm text-gray-500">{formatDateTime(job.completedAt)}</p> : job.stage === PopulationImportStage.PENDING ? <p className="mt-1 text-sm text-gray-500">ตรวจสอบรายการก่อนยืนยันการนำเข้า</p> : <p className="mt-1 text-sm text-gray-500">{stageLabel(job.stage)}</p>}</div></div></section>

    <details className="rounded-xl border border-gray-200 bg-white"><summary className="cursor-pointer px-4 py-3.5 text-sm font-semibold text-gray-900 marker:text-gray-500">รายละเอียดงานนำเข้า</summary><div className="space-y-5 border-t border-gray-100 px-4 py-4 sm:px-5"><section><h2 className="text-sm font-semibold text-gray-900">ข้อมูลไฟล์</h2><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-gray-500">ชื่อไฟล์</dt><dd className="mt-1 break-words font-medium text-gray-900">{job.fileName}</dd></div><div><dt className="text-xs text-gray-500">สร้างงานเมื่อ</dt><dd className="mt-1 font-medium text-gray-900">{formatDateTime(job.createdAt)}</dd></div><div><dt className="text-xs text-gray-500">เริ่มประมวลผลเมื่อ</dt><dd className="mt-1 font-medium text-gray-900">{job.startedAt ? formatDateTime(job.startedAt) : "-"}</dd></div><div><dt className="text-xs text-gray-500">เสร็จสิ้นเมื่อ</dt><dd className="mt-1 font-medium text-gray-900">{job.completedAt ? formatDateTime(job.completedAt) : "-"}</dd></div></dl></section><section className="border-t border-gray-100 pt-4"><h2 className="text-sm font-semibold text-gray-900">ข้อมูลที่พบในไฟล์</h2>{sourceHeaders.length ? <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{COLUMN_GROUPS.map((group) => { const headers = sourceHeaders.map((header) => ({ header, key: canonicalHeader(header) })).filter((item) => item.key && group.keys.includes(item.key as never)); return headers.length ? <div key={group.title}><h3 className="text-xs font-medium text-gray-500">{group.title}</h3><ul className="mt-1.5 space-y-1 text-sm text-gray-700">{headers.map(({ header, key }) => <li key={header}>• {group.labels[key as keyof typeof group.labels] ?? header}</li>)}</ul></div> : null; })}</div> : <p className="mt-2 text-sm text-gray-500">ไม่พบรายละเอียดคอลัมน์สำหรับงานนี้</p>}{unknownHeaders.length ? <details className="mt-4"><summary className="cursor-pointer text-sm text-gray-600">ข้อมูลเพิ่มเติม</summary><p className="mt-2 break-words text-sm leading-6 text-gray-500">{unknownHeaders.join(", ")}</p></details> : null}</section></div></details>

    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><h2 className="text-base font-semibold text-gray-900">{isPreview ? "สรุปผลตรวจสอบ" : "ผลการนำเข้าข้อมูล"}</h2><div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3 text-sm sm:flex sm:flex-wrap"><p>ทั้งหมด <strong className="text-gray-900">{job.totalRows.toLocaleString("th-TH")}</strong></p>{!isPreview ? <><p>สำเร็จ <strong className="text-green-700">{job.importedRows.toLocaleString("th-TH")}</strong></p><p className={job.failedRows > 0 ? "text-red-700" : ""}>ไม่สำเร็จ <strong>{job.failedRows.toLocaleString("th-TH")}</strong></p></> : null}<p>สร้างใหม่ <strong className="text-gray-900">{job.createdRows.toLocaleString("th-TH")}</strong></p><p>อัปเดตข้อมูล <strong className="text-gray-900">{job.updatedRows.toLocaleString("th-TH")}</strong></p>{job.conflictRows > 0 ? <p className="text-amber-700">ต้องตรวจสอบ <strong>{job.conflictRows.toLocaleString("th-TH")}</strong></p> : null}{job.skippedRows > 0 ? <p>ข้าม <strong className="text-gray-900">{job.skippedRows.toLocaleString("th-TH")}</strong></p> : null}</div>{job.updatedRows > 0 ? <p className="mt-3 border-t border-gray-100 pt-3 text-sm leading-5 text-gray-500">อัปเดตข้อมูล หมายถึง ระบบพบข้อมูลบุคคลเดิมที่ตรงกันและปรับปรุงข้อมูลเดิม แทนการสร้างบุคคลซ้ำ</p> : null}</section>

    <section className="rounded-xl border border-gray-200 bg-white"><div className="border-b border-gray-100 px-4 py-4 sm:px-5"><h2 className="text-base font-semibold text-gray-900">{isPreview ? "รายการที่จะนำเข้า" : "ผลลัพธ์รายรายการ"}</h2><p className="mt-1 text-sm text-gray-500">{isPreview ? "ตรวจสอบผลของแต่ละแถวก่อนยืนยันการนำเข้า" : "แสดงผลการดำเนินการของแต่ละแถว"}</p></div>{reviewRows.length === 0 ? <p className="px-4 py-6 text-sm text-gray-500">ไม่พบรายละเอียดแถวสำหรับงานนี้</p> : <div className="divide-y divide-gray-100">{reviewRows.slice(0, 100).map((item, index) => { const row = item.row; const fallback = item.fallback; const rowNumber = item.detail?.rowNumber ?? item.rowNumber ?? index + 2; const house = row?.houseNumber ?? fallback?.house_number ?? "-"; const name = [row?.firstName ?? fallback?.first_name, row?.lastName ?? fallback?.last_name].filter(Boolean).join(" ") || "ไม่มีข้อมูลบุคคล"; const action = item.detail?.action ?? row?.action; return <article key={`${rowNumber}-${index}`} className="px-4 py-3 sm:px-5"><div className="grid gap-1 text-sm sm:grid-cols-[5rem_minmax(7rem,1fr)_minmax(10rem,1.5fr)_auto] sm:items-start sm:gap-3"><p><span className="text-gray-500">แถว </span><span className="font-medium text-gray-900">{rowNumber}</span></p><p><span className="text-gray-500">บ้าน </span><span className="font-medium text-gray-900">{house}</span></p><p className="font-medium text-gray-900">{name}</p><p className={`font-medium ${actionTone(action)}`}>{actionLabel(action)}</p></div><p className="mt-1 text-sm leading-5 text-gray-500">{rowMessage(item.detail, row?.note ?? fallback?.note)}</p></article>; })}</div>}</section>

    {isPreview ? <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><h2 className="text-base font-semibold text-gray-900">ยืนยันการนำเข้าข้อมูล</h2><p className="mt-1 text-sm leading-5 text-gray-500">ข้อมูลจะยังไม่ถูกบันทึกจนกว่าจะยืนยัน รายการที่ต้องตรวจสอบหรือไม่สามารถนำเข้าจะไม่ถูกบันทึก</p><div className="mt-4"><ImportJobActions jobId={job.id} createdRows={job.createdRows} updatedRows={job.updatedRows} conflictRows={job.conflictRows} failedRows={invalidRows} cleanupPeopleCount={0} cleanupHousesCount={0} canConfirm canCleanup={false} /></div></section> : null}

    {isCompleted ? <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><h2 className="text-base font-semibold text-gray-900">ข้อมูลที่เกี่ยวข้องกับงานนี้</h2>{createdPeople.length === 0 && createdHouses.length === 0 ? <p className="mt-3 text-sm text-gray-500">ไม่พบข้อมูลที่ติดตามได้ว่าเป็นรายการที่สร้างใหม่จากงานนี้</p> : <div className="mt-4 space-y-5">{createdHouses.length ? <section><h3 className="text-sm font-semibold text-gray-900">ทะเบียนบ้าน ({createdHouses.length.toLocaleString("th-TH")})</h3><ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-100">{createdHouses.map((house) => <li key={house.id} className="flex items-center justify-between gap-3 px-3 py-2.5"><p className="text-sm font-medium text-gray-900">บ้าน {house.houseNumber}</p><Link href={`/admin/population/houses/${house.id}`} className="shrink-0 text-sm font-medium text-green-700 hover:underline">ดูข้อมูลบ้าน</Link></li>)}</ul></section> : null}{createdPeople.length ? <section><h3 className="text-sm font-semibold text-gray-900">ทะเบียนประชากร ({createdPeople.length.toLocaleString("th-TH")})</h3><ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-100">{createdPeople.map((person) => <li key={person.id} className="flex items-center justify-between gap-3 px-3 py-2.5"><p className="min-w-0 text-sm text-gray-700"><span className="font-medium text-gray-900">{person.firstName} {person.lastName}</span> · บ้าน {person.house?.houseNumber ?? "-"}</p><Link href={`/admin/population/people/${person.id}`} className="shrink-0 text-sm font-medium text-green-700 hover:underline">ดูข้อมูล</Link></li>)}</ul></section> : null}</div>}</section> : null}
    {!isPreview && hasIssues ? <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><h2 className="text-base font-semibold text-gray-900">รายการที่ต้องตรวจสอบ</h2><p className="mt-1 text-sm text-gray-500">ดาวน์โหลดรายงานข้อผิดพลาดเพื่อดูรายละเอียดเพิ่มเติม</p>{rowDetails.filter((row) => row.action === "CONFLICT" || row.action === "FAILED").length > 0 ? <ul className="mt-3 divide-y divide-gray-100">{rowDetails.filter((row) => row.action === "CONFLICT" || row.action === "FAILED").slice(0, 20).map((row) => <li key={row.rowNumber} className="py-2 text-sm"><span className={`font-medium ${actionTone(row.action)}`}>แถว {row.rowNumber} · {actionLabel(row.action)}</span><p className="mt-1 text-gray-600">{rowMessage(row)}</p></li>)}</ul> : null}</section> : null}
    {isCompleted && canCleanup ? <section className="border-t border-gray-200 pt-5"><h2 className="text-sm font-semibold text-gray-900">การจัดการงานนำเข้า</h2><p className="mt-1 max-w-2xl text-sm leading-5 text-gray-500">ลบได้เฉพาะข้อมูลที่ระบบติดตามว่าเป็นรายการสร้างใหม่ ข้อมูลเดิมที่ถูกอัปเดตจะไม่กลับเป็นค่าเดิมโดยอัตโนมัติ</p><div className="mt-3"><ImportJobActions jobId={job.id} createdRows={job.createdRows} updatedRows={job.updatedRows} conflictRows={job.conflictRows} failedRows={job.failedRows} cleanupPeopleCount={createdPeople.length} cleanupHousesCount={createdHouses.length} canConfirm={false} canCleanup /></div></section> : null}
  </div>;
}
