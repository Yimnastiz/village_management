import { MembershipStatus, PopulationImportStage, VillageMembershipRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { computeLandingPath, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { PopulationImportForm } from "./import-form";
import { POPULATION_IMPORT_COLUMNS } from "./import-template";

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

export default async function Page() {
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

  const [village, recentJobs] = await Promise.all([
    prisma.village.findUnique({
      where: { id: adminMembership.villageId },
      select: { id: true, name: true },
    }),
    prisma.populationImportJob.findMany({
      where: { villageId: adminMembership.villageId },
      orderBy: { createdAt: "desc" },
      take: 10,
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">นำเข้าข้อมูลประชากร</h1>
          <p className="mt-1 text-sm text-gray-500">
            ใช้สำหรับนำเข้าข้อมูลบ้านและประชากรของ {village?.name ?? "หมู่บ้านของคุณ"} จาก Excel หรือ CSV
          </p>
        </div>
        <a href="/api/admin/population/import-template">
          <Button variant="outline">ดาวน์โหลดไฟล์ตัวอย่าง</Button>
        </a>
      </div>

      <PopulationImportForm />

      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">โครงสร้างไฟล์ Excel ที่รองรับ</h2>
              <p className="mt-1 text-sm text-gray-500">อย่างน้อยต้องมี 3 คอลัมน์หลักคือ house_number, first_name และ last_name</p>
            </div>
            <Badge variant="outline">{POPULATION_IMPORT_COLUMNS.length} คอลัมน์มาตรฐาน</Badge>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2">คีย์คอลัมน์</th>
                  <th className="px-3 py-2">ชื่อใช้ในไฟล์</th>
                  <th className="px-3 py-2">บังคับ</th>
                  <th className="px-3 py-2">รายละเอียด</th>
                  <th className="px-3 py-2">ตัวอย่าง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {POPULATION_IMPORT_COLUMNS.map((column) => (
                  <tr key={column.key} className="align-top">
                    <td className="px-3 py-3 font-mono text-xs text-gray-700">{column.key}</td>
                    <td className="px-3 py-3 text-gray-900">{column.label}</td>
                    <td className="px-3 py-3">
                      <Badge variant={column.required ? "danger" : "outline"}>
                        {column.required ? "จำเป็น" : "ไม่บังคับ"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-gray-600">
                      <p>{column.description}</p>
                      {column.aliases && column.aliases.length > 0 && (
                        <p className="mt-1 text-xs text-gray-500">หัวข้อเดิมที่รองรับ: {column.aliases.join(", ")}</p>
                      )}
                      {column.acceptedValues && (
                        <p className="mt-1 text-xs text-gray-500">ค่าที่รับ: {column.acceptedValues}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-600">{column.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-900">หลักการนำเข้าจริง</h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li>ถ้ามีบ้านเดิม ระบบจะอัปเดตข้อมูลบ้านตาม house_number เดิมในหมู่บ้านเดียวกัน</li>
              <li>ถ้ามี phone_number และ create_user_account เป็นจริง ระบบจะสร้างหรืออัปเดตบัญชีผู้ใช้พร้อมผูกเป็นลูกบ้าน</li>
              <li>ถ้ามี national_id หรือ phone_number ระบบจะพยายามจับคู่บุคคลเดิมก่อนสร้างคนใหม่</li>
              <li>ถ้ามี zone_name ระบบจะสร้างโซนให้อัตโนมัติถ้ายังไม่มี</li>
              <li>ถ้าไฟล์มีบางแถวผิด ระบบจะนำเข้าเฉพาะแถวที่ถูกต้องและสรุปแถวที่ผิดให้</li>
            </ul>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-900">งานนำเข้าล่าสุด</h2>
            <div className="mt-3 space-y-3">
              {recentJobs.length === 0 ? (
                <p className="text-sm text-gray-500">ยังไม่มีประวัติการนำเข้า</p>
              ) : (
                recentJobs.map((job) => {
                  const errors = Array.isArray(job.errors) ? job.errors : [];
                  return (
                    <div key={job.id} className="rounded-lg border border-gray-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">{job.fileName}</p>
                        <Badge variant={getStageBadgeVariant(job.stage)}>{getStageLabel(job.stage)}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {job.createdAt.toLocaleString("th-TH")} • ทั้งหมด {job.totalRows} • สำเร็จ {job.importedRows} • ไม่สำเร็จ {job.failedRows}
                      </p>
                      {errors.length > 0 && (
                        <details className="mt-3 text-xs text-red-700">
                          <summary className="cursor-pointer font-medium">ดูข้อผิดพลาด</summary>
                          <ul className="mt-2 space-y-1">
                            {errors.slice(0, 10).map((error) => (
                              <li key={String(error)}>{String(error)}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
