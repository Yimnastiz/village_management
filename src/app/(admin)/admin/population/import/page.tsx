import { MembershipStatus, PopulationImportStage, Prisma, VillageMembershipRole } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { computeLandingPath, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { PopulationImportForm } from "./import-form";
import { ImportPreparationDisclosure } from "./import-preparation-disclosure";

const ADMIN_MEMBERSHIP_ROLES = new Set<VillageMembershipRole>([
  VillageMembershipRole.HEADMAN,
  VillageMembershipRole.ASSISTANT_HEADMAN,
]);

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

function getJobErrors(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  if (value && typeof value === "object" && Array.isArray((value as { errors?: unknown[] }).errors)) {
    return (value as { errors: unknown[] }).errors.map((item) => String(item));
  }

  return [];
}

type CleanupSummary = { cleanedAt: string; deletedPeople: number; deletedHouses: number; skippedCount: number };
function getLatestCleanup(value: unknown): CleanupSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const history = (value as { cleanupHistory?: unknown }).cleanupHistory;
  if (!Array.isArray(history) || history.length === 0) return null;
  const latest = history[history.length - 1];
  if (!latest || typeof latest !== "object" || Array.isArray(latest) || typeof (latest as { cleanedAt?: unknown }).cleanedAt !== "string") return null;
  const entry = latest as Partial<CleanupSummary>;
  return { cleanedAt: entry.cleanedAt!, deletedPeople: Number(entry.deletedPeople) || 0, deletedHouses: Number(entry.deletedHouses) || 0, skippedCount: Number(entry.skippedCount) || 0 };
}

type PageProps = {
  searchParams?: Promise<{ q?: string; status?: string; from?: string; to?: string; sort?: string }>;
};

function parseDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default async function Page({ searchParams }: PageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};
  const session = await getSessionContextFromServerCookies();

  if (!session) {
    redirect("/auth/login?callbackUrl=/admin/population/import");
  }

  if (!isAdminUser(session)) {
    redirect(computeLandingPath(session));
  }

  const adminMembership = session.memberships.find(
    (membership) =>
      membership.status === MembershipStatus.ACTIVE &&
      ADMIN_MEMBERSHIP_ROLES.has(membership.role),
  );

  if (!adminMembership) {
    redirect(computeLandingPath(session));
  }

  const keyword = params.q?.trim() ?? "";
  const status = params.status ?? "ALL";
  const sort = params.sort ?? "latest";
  const from = params.from?.trim() ?? "";
  const to = params.to?.trim() ?? "";
  const fromDate = parseDate(from);
  const toDate = parseDate(to);

  const where: Prisma.PopulationImportJobWhereInput = {
    villageId: adminMembership.villageId,
  };

  if (keyword) {
    where.fileName = { contains: keyword, mode: "insensitive" };
  }

  if (status !== "ALL" && Object.values(PopulationImportStage).includes(status as PopulationImportStage)) {
    where.stage = status as PopulationImportStage;
  }

  if (fromDate || toDate) {
    where.createdAt = {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lt: new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate() + 1) } : {}),
    };
  }

  const orderBy: Prisma.PopulationImportJobOrderByWithRelationInput[] =
    sort === "oldest"
      ? [{ createdAt: "asc" }]
      : sort === "filename_az"
        ? [{ fileName: "asc" }, { createdAt: "desc" }]
        : [{ createdAt: "desc" }];

  const recentJobs = await prisma.populationImportJob.findMany({
      where,
      orderBy,
      take: 30,
      select: {
        id: true,
        fileName: true,
        stage: true,
        totalRows: true,
        importedRows: true,
        failedRows: true,
        errors: true,
        createdAt: true,
        completedAt: true,
      },
  });

  return (
    <div data-admin-compact-top className="space-y-3">
      <AdminPageToolbar
        sticky
        variant="form"
        title="นำเข้าข้อมูลบ้านและประชากร"
        description="เพิ่มหรือปรับปรุงข้อมูลบ้านและประชากรหลายรายการพร้อมกันจากไฟล์ Excel"
        actions={
          <>
            <a href="/api/admin/population/import-template" download className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              ดาวน์โหลดไฟล์ตัวอย่าง
            </a>
            <a href="/admin/population/export" className="inline-flex items-center justify-center rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700">
              ส่งออกข้อมูล
            </a>
          </>
        }
      />

      {/* Main Import Form */}
      <PopulationImportForm
        showTemplateDownload={false}
        showPreparationNotes={false}
        preUploadContent={
          <>
            <ImportPreparationDisclosure />
            <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5" aria-labelledby="supported-import-data-heading">
              <h2 id="supported-import-data-heading" className="text-base font-semibold text-gray-900">ข้อมูลที่สามารถนำเข้าได้</h2>
              <div className="mt-3 grid gap-4 md:grid-cols-3">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">ข้อมูลบ้าน</h3>
                  <ul className="mt-1.5 space-y-1 text-sm leading-5 text-gray-600">
                    <li>เลขที่บ้าน (จำเป็น)</li><li>รายละเอียดที่อยู่</li><li>สถานะบ้าน</li><li>พิกัด</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900">ข้อมูลบุคคล</h3>
                  <ul className="mt-1.5 grid gap-x-5 gap-y-1 text-sm leading-5 text-gray-600 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                    <li>ชื่อ</li><li>นามสกุล</li><li>เบอร์โทรศัพท์</li><li>เลขบัตรประชาชน</li><li>วันเกิด</li><li>เพศ</li><li>สถานะบุคคล</li><li>หมายเหตุ</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900">ข้อมูลเหตุการณ์ประชากร</h3>
                  <ul className="mt-1.5 space-y-1 text-sm leading-5 text-gray-600">
                    <li>เหตุการณ์ประชากร</li><li>วันที่เกิดเหตุการณ์</li>
                  </ul>
                </div>
              </div>
              <div className="mt-3 border-t border-gray-100 pt-3 text-xs leading-5 text-gray-500">
                <p>ข้อมูลขั้นต่ำ: เลขที่บ้าน</p>
                <p>หากนำเข้าข้อมูลบุคคล ต้องระบุชื่อและนามสกุลให้ครบ</p>
              </div>
            </section>
          </>
        }
      />

      {/* Recent Jobs */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">งานนำเข้าล่าสุด</h2>
            <p className="mt-1 text-sm text-gray-500">ค้นหาและติดตามสถานะการนำเข้าข้อมูล</p>
          </div>
        </div>
        <form method="get" className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-5">
            <input
              name="q"
              defaultValue={keyword}
              placeholder="ค้นหาชื่อไฟล์..."
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <select name="status" defaultValue={status} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="ALL">ทุกสถานะ</option>
              {Object.values(PopulationImportStage).map((stage) => (
                <option key={stage} value={stage}>{getStageLabel(stage)}</option>
              ))}
            </select>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="จากวันที่"
            />
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="ถึงวันที่"
            />
            <select name="sort" defaultValue={sort} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="latest">ล่าสุดก่อน</option>
              <option value="oldest">เก่าสุดก่อน</option>
              <option value="filename_az">ชื่อไฟล์ A-Z</option>
            </select>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="submit" variant="outline">
              ค้นหา
            </Button>
            {(keyword || status !== "ALL" || from || to) && (
              <Link
                href="/admin/population/import"
                className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ล้างตัวกรอง
              </Link>
            )}
          </div>
        </form>
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="space-y-3">
            {recentJobs.length === 0 ? (
              <p className="text-sm text-gray-500">ยังไม่มีประวัติการนำเข้า</p>
            ) : (
              recentJobs.map((job) => {
                const errors = getJobErrors(job.errors);
                const cleanup = getLatestCleanup(job.errors);
                const cleanupWasPartial = cleanup ? cleanup.skippedCount > 0 : false;
                return (
                  <div key={job.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{job.fileName}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {job.createdAt.toLocaleString("th-TH")} • {job.totalRows} แถว: {job.importedRows} สำเร็จ, {job.failedRows} ไม่สำเร็จ
                        </p>
                      </div>
                      <Badge variant={cleanup ? (cleanupWasPartial ? "warning" : "outline") : getStageBadgeVariant(job.stage)}>{cleanup ? (cleanupWasPartial ? "ลบข้อมูลนำเข้าได้บางส่วน" : "ลบข้อมูลที่นำเข้าแล้ว") : job.stage === PopulationImportStage.COMPLETED ? "นำเข้าสำเร็จ" : getStageLabel(job.stage)}</Badge>
                    </div>
                    {cleanup ? <p className="mt-1.5 text-xs text-slate-500">{job.completedAt ? `นำเข้าสำเร็จเมื่อ ${job.completedAt.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })} · ` : ""}ลบข้อมูลเมื่อ {new Date(cleanup.cleanedAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}</p> : null}
                    <Link
                      href={`/admin/population/import/${job.id}`}
                      className="mt-2 inline-flex text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      ดูรายละเอียด →
                    </Link>
                    {errors.length > 0 && (
                      <details className="mt-2 text-xs text-red-600">
                        <summary className="cursor-pointer font-medium">ข้อผิดพลาด ({errors.length})</summary>
                        <ul className="mt-2 space-y-1 pl-4">
                          {errors.slice(0, 5).map((error, idx) => (
                            <li key={idx} className="text-red-600">• {error}</li>
                          ))}
                          {errors.length > 5 && <li className="text-gray-500">และอีก {errors.length - 5} ข้อ...</li>}
                        </ul>
                      </details>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
