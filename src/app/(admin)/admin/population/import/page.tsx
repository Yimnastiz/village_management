import { MembershipStatus, PopulationImportStage, Prisma, VillageMembershipRole } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { computeLandingPath, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { PopulationImportForm } from "./import-form";
import { POPULATION_IMPORT_COLUMNS_ADMIN } from "@/features/population/server/import-template";

const ADMIN_MEMBERSHIP_ROLES = new Set<VillageMembershipRole>([
  VillageMembershipRole.HEADMAN,
  VillageMembershipRole.ASSISTANT_HEADMAN,
  VillageMembershipRole.COMMITTEE,
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

  const [village, recentJobs] = await Promise.all([
    prisma.village.findUnique({
      where: { id: adminMembership.villageId },
      select: { id: true, name: true },
    }),
    prisma.populationImportJob.findMany({
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
    }),
  ]);

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">นำเข้าข้อมูลบ้านและประชากร</h1>
        <p className="mt-2 text-base text-gray-600">
          เพิ่มหรือปรับปรุงข้อมูลบ้านและประชากรหลายรายการพร้อมกันจากไฟล์ Excel
        </p>
        <div className="mt-4 space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p>
            ข้อมูลที่นำเข้าจะใช้เป็นทะเบียนข้อมูลของหมู่บ้าน และสามารถใช้ช่วยตรวจสอบหรือจับคู่ข้อมูลเมื่อลูกบ้านสมัครและขอผูกเลขบ้านในภายหลัง
          </p>
          <p className="font-medium">การนำเข้าข้อมูลไม่ใช่การยืนยันตัวตนของลูกบ้านโดยอัตโนมัติ</p>
        </div>
      </div>

      {/* Main Import Form */}
      <PopulationImportForm />

      {/* Filters and Search */}
      <section>
        <form method="get" className="rounded-lg border border-gray-200 bg-white p-5">
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
      </section>

      {/* Data Format Info */}
      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">ข้อมูลที่สามารถนำเข้าได้</h2>

        <div className="mt-4 space-y-4">
          {/* House Data */}
          <div>
            <h3 className="font-medium text-gray-900">ข้อมูลบ้าน</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {POPULATION_IMPORT_COLUMNS_ADMIN.filter((col) =>
                ["house_number", "house_address", "zone_name", "occupancy_status", "latitude", "longitude"].includes(col.key)
              ).map((col) => (
                <div key={col.key} className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs sm:text-sm">
                  <span className="font-medium text-gray-900">{col.label}</span>
                  {col.required && <Badge variant="danger">บังคับ</Badge>}
                </div>
              ))}
            </div>
          </div>

          {/* Person Data */}
          <div>
            <h3 className="font-medium text-gray-900">ข้อมูลบุคคล</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {POPULATION_IMPORT_COLUMNS_ADMIN.filter((col) =>
                ["first_name", "last_name", "phone_number", "national_id", "date_of_birth", "gender", "person_status", "email", "external_person_id", "note"].includes(col.key)
              ).map((col) => (
                <div key={col.key} className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs sm:text-sm">
                  <span className="font-medium text-gray-900">{col.label}</span>
                  {col.required && <Badge variant="danger">บังคับ</Badge>}
                </div>
              ))}
            </div>
          </div>

          {/* Requirements */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-900">ต้องมีอย่างน้อย: เลขที่บ้าน</p>
            <p className="mt-1 text-xs text-amber-800">
              หากต้องการนำเข้าบุคคล ต้องระบุชื่อและนามสกุลให้ครบ
            </p>
          </div>
        </div>
      </section>

      {/* Recent Jobs and Export */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">งานนำเข้าล่าสุด</h2>
          <div className="mt-4 space-y-3">
            {recentJobs.length === 0 ? (
              <p className="text-sm text-gray-500">ยังไม่มีประวัติการนำเข้า</p>
            ) : (
              recentJobs.map((job) => {
                const errors = getJobErrors(job.errors);
                return (
                  <div key={job.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{job.fileName}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {job.createdAt.toLocaleString("th-TH")} • {job.totalRows} แถว: {job.importedRows} สำเร็จ, {job.failedRows} ไม่สำเร็จ
                        </p>
                      </div>
                      <Badge variant={getStageBadgeVariant(job.stage)}>{getStageLabel(job.stage)}</Badge>
                    </div>
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

        {/* Export Section */}
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-900">ส่งออกข้อมูล</h2>
            <p className="mt-2 text-xs text-gray-600">
              ส่งออกข้อมูลล่าสุดของหมู่บ้านเป็น Excel เพื่อตรวจสอบหรือส่งต่อหน่วยงาน
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <a
                href="/api/admin/population/export"
                download
                className="inline-flex items-center justify-center rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                ดาวน์โหลด Excel ทันที
              </a>
              <Link
                href="/admin/population/export"
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                เปิดหน้าส่งออก
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
