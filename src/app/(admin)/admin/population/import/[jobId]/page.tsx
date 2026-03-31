import { MembershipStatus, PopulationImportStage, VillageMembershipRole } from "@prisma/client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { computeLandingPath, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { POPULATION_IMPORT_COLUMNS } from "../import-template";
import { prisma } from "@/lib/prisma";
import { deleteImportedPersonAction, deleteImportJobDatasetAction } from "./actions";

const ADMIN_MEMBERSHIP_ROLES = new Set<VillageMembershipRole>([
  VillageMembershipRole.HEADMAN,
  VillageMembershipRole.ASSISTANT_HEADMAN,
  VillageMembershipRole.COMMITTEE,
]);

type ImportJobDetailsPayload = {
  errors?: string[];
  sourceHeaders?: string[];
  previewColumns?: string[];
  previewRows?: Array<Record<string, string>>;
  importedPersonIds?: string[];
  importedHouseIds?: string[];
  importedUserIds?: string[];
};

function getStageBadgeVariant(stage: PopulationImportStage) {
  switch (stage) {
    case PopulationImportStage.COMPLETED:
      return "success" as const;
    case PopulationImportStage.PARTIAL:
      return "warning" as const;
    case PopulationImportStage.FAILED:
      return "danger" as const;
    case PopulationImportStage.PROCESSING:
      return "info" as const;
    default:
      return "outline" as const;
  }
}

function getStageLabel(stage: PopulationImportStage) {
  switch (stage) {
    case PopulationImportStage.PENDING:
      return "รอดำเนินการ";
    case PopulationImportStage.PROCESSING:
      return "กำลังประมวลผล";
    case PopulationImportStage.COMPLETED:
      return "สำเร็จ";
    case PopulationImportStage.PARTIAL:
      return "สำเร็จบางส่วน";
    case PopulationImportStage.FAILED:
      return "ล้มเหลว";
  }
}

function parsePayload(value: unknown): ImportJobDetailsPayload {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as ImportJobDetailsPayload;
  }

  if (Array.isArray(value)) {
    return { errors: value.map((item) => String(item)) };
  }

  return {};
}

function getColumnLabel(key: string) {
  return POPULATION_IMPORT_COLUMNS.find((column) => column.key === key)?.label ?? key;
}

interface PageProps { params: Promise<{ jobId: string }> }

export default async function Page({ params }: PageProps) {
  const { jobId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/admin/population/import");
  if (!isAdminUser(session)) redirect(computeLandingPath(session));

  const adminMembership = session.memberships.find(
    (membership) =>
      membership.status === MembershipStatus.ACTIVE &&
      ADMIN_MEMBERSHIP_ROLES.has(membership.role),
  );
  if (!adminMembership) redirect(computeLandingPath(session));

  const job = await prisma.populationImportJob.findFirst({
    where: {
      id: jobId,
      villageId: adminMembership.villageId,
    },
    select: {
      id: true,
      fileName: true,
      stage: true,
      totalRows: true,
      importedRows: true,
      failedRows: true,
      errors: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
      village: { select: { name: true } },
    },
  });

  if (!job) {
    notFound();
  }

  const payload = parsePayload(job.errors);
  const errors = payload.errors ?? [];
  const sourceHeaders = payload.sourceHeaders ?? [];
  const previewColumns = payload.previewColumns ?? [];
  const previewRows = payload.previewRows ?? [];
  const importedPersonIds = payload.importedPersonIds ?? [];
  const importedUserIds = payload.importedUserIds ?? [];
  const importedHouseIds = payload.importedHouseIds ?? [];

  const importedPeople = importedPersonIds.length
    ? await prisma.person.findMany({
        where: {
          id: { in: importedPersonIds },
          villageId: adminMembership.villageId,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          nationalId: true,
          house: { select: { houseNumber: true } },
          updatedAt: true,
        },
        orderBy: [{ updatedAt: "desc" }],
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">รายละเอียดงานนำเข้า</h1>
          <p className="mt-1 text-sm text-gray-500">ไฟล์ {job.fileName} • {job.village.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/population/import" className="inline-flex w-full sm:w-auto items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            กลับหน้ารายนำเข้า
          </Link>
          <a href="/api/admin/population/export" className="inline-flex w-full sm:w-auto items-center justify-center rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700">
            ส่งออกข้อมูลล่าสุด
          </a>
          {errors.length > 0 && (
            <a
              href={`/api/admin/population/import/${job.id}/error-report`}
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              ดาวน์โหลด error report (.csv)
            </a>
          )}
        </div>
      </div>

      <section className="rounded-xl border border-red-200 bg-red-50 p-4">
        <h2 className="text-sm font-semibold text-red-800">ลบข้อมูลจากชุดนำเข้าของงานนี้</h2>
        <p className="mt-1 text-xs text-red-700">
          สำหรับงานนี้พบข้อมูลที่ติดตามได้: บุคคล {importedPersonIds.length} รายการ • บ้าน {importedHouseIds.length} หลัง • บัญชี {importedUserIds.length} รายการ
        </p>
        <form action={deleteImportJobDatasetAction} className="mt-3">
          <input type="hidden" name="jobId" value={job.id} />
          <button
            type="submit"
            className="inline-flex w-full sm:w-auto items-center justify-center rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            ลบข้อมูลทั้งชุดจากงานนำเข้านี้
          </button>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">สถานะงาน</p>
          <div className="mt-2"><Badge variant={getStageBadgeVariant(job.stage)}>{getStageLabel(job.stage)}</Badge></div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">จำนวนแถวทั้งหมด</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{job.totalRows.toLocaleString("th-TH")}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">นำเข้าสำเร็จ</p>
          <p className="mt-1 text-2xl font-bold text-green-700">{job.importedRows.toLocaleString("th-TH")}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">นำเข้าไม่สำเร็จ</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{job.failedRows.toLocaleString("th-TH")}</p>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">เวลาและไฟล์</h2>
        <div className="mt-3 grid gap-3 text-sm text-gray-600 md:grid-cols-2">
          <p>ไฟล์ต้นฉบับ: <span className="font-medium text-gray-900">{job.fileName}</span></p>
          <p>สร้างงานเมื่อ: <span className="font-medium text-gray-900">{job.createdAt.toLocaleString("th-TH")}</span></p>
          <p>เริ่มประมวลผล: <span className="font-medium text-gray-900">{job.startedAt ? job.startedAt.toLocaleString("th-TH") : "-"}</span></p>
          <p>เสร็จสิ้น: <span className="font-medium text-gray-900">{job.completedAt ? job.completedAt.toLocaleString("th-TH") : "-"}</span></p>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">หัวคอลัมน์จากเอกสารที่นำเข้า</h2>
        {sourceHeaders.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">ไม่พบข้อมูลหัวคอลัมน์ในงานนี้ (อาจเป็นงานจากเวอร์ชันเก่า)</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {sourceHeaders.map((header) => (
              <Badge key={header} variant="outline">{header}</Badge>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">ตัวอย่างข้อมูลเอกสารที่นำเข้า</h2>
        {previewColumns.length === 0 || previewRows.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">ไม่พบข้อมูลตัวอย่างเอกสารในงานนี้ (อาจเป็นงานจากเวอร์ชันเก่า)</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                  {previewColumns.map((column) => (
                    <th key={column} className="px-3 py-2">{getColumnLabel(column)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {previewRows.map((row, index) => (
                  <tr key={`preview-${index}`}>
                    {previewColumns.map((column) => (
                      <td key={`${index}-${column}`} className="px-3 py-2 text-gray-700">{row[column] ?? ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">ลบเฉพาะบางคนจากงานนำเข้า</h2>
        {importedPeople.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">ไม่พบข้อมูลคนที่ติดตามได้ในงานนี้ (อาจเป็นงานจากเวอร์ชันเก่า)</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2">ชื่อ-นามสกุล</th>
                  <th className="px-3 py-2">เลขที่บ้าน</th>
                  <th className="px-3 py-2">เบอร์โทร</th>
                  <th className="px-3 py-2">เลขบัตร</th>
                  <th className="px-3 py-2">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {importedPeople.map((person) => (
                  <tr key={person.id}>
                    <td className="px-3 py-2 text-gray-900">{person.firstName} {person.lastName}</td>
                    <td className="px-3 py-2 text-gray-700">{person.house?.houseNumber ?? "-"}</td>
                    <td className="px-3 py-2 text-gray-700">{person.phone ?? "-"}</td>
                    <td className="px-3 py-2 text-gray-700">{person.nationalId ?? "-"}</td>
                    <td className="px-3 py-2">
                      <form action={deleteImportedPersonAction}>
                        <input type="hidden" name="jobId" value={job.id} />
                        <input type="hidden" name="personId" value={person.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center rounded-md border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                        >
                          ลบคนนี้
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">ข้อผิดพลาดจากการนำเข้า</h2>
        {errors.length === 0 ? (
          <p className="mt-3 text-sm text-green-700">ไม่พบข้อผิดพลาดจากงานนำเข้านี้</p>
        ) : (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-red-700">
            {errors.map((error, index) => (
              <li key={`${index}-${error}`}>{error}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
