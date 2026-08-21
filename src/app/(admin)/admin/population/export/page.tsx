import { MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { FileSpreadsheet, Home, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PopulationExportForm } from "@/features/population/components/population-export-form";
import { computeLandingPath, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

const ADMIN_MEMBERSHIP_ROLES = new Set<VillageMembershipRole>([
  VillageMembershipRole.HEADMAN,
  VillageMembershipRole.ASSISTANT_HEADMAN,
  VillageMembershipRole.COMMITTEE,
]);

export default async function Page() {
  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/admin/population/export");
  if (!isAdminUser(session)) redirect(computeLandingPath(session));

  const adminMembership = session.memberships.find(
    (membership) =>
      membership.status === MembershipStatus.ACTIVE && ADMIN_MEMBERSHIP_ROLES.has(membership.role),
  );
  if (!adminMembership) redirect(computeLandingPath(session));
  const canExportFullRegistry = adminMembership.role === VillageMembershipRole.HEADMAN;

  const [village, houseCount, peopleCount, accountCount, zones] = await Promise.all([
    prisma.village.findUnique({ where: { id: adminMembership.villageId }, select: { name: true } }),
    prisma.house.count({ where: { villageId: adminMembership.villageId } }),
    prisma.person.count({ where: { villageId: adminMembership.villageId } }),
    prisma.villageMembership.count({ where: { villageId: adminMembership.villageId } }),
    prisma.villageZone.findMany({ where: { villageId: adminMembership.villageId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ส่งออกข้อมูลประชากร</h1>
          <p className="mt-1 text-sm text-gray-500">ส่งออกข้อมูลบ้าน คน และบัญชีผู้ใช้ของ {village?.name ?? "หมู่บ้านของคุณ"} เป็นไฟล์ Excel เดียว</p>
        </div>
        <PopulationExportForm zones={zones} canExportFullRegistry={canExportFullRegistry} />
      </div>

      {canExportFullRegistry ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">ไฟล์ส่งออกมีข้อมูลส่วนบุคคล กรุณาจัดเก็บและใช้งานอย่างเหมาะสม</p> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 text-gray-500">
            <Home className="h-4 w-4" /> บ้าน
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">{houseCount.toLocaleString("th-TH")}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 text-gray-500">
            <Users className="h-4 w-4" /> บุคคล
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">{peopleCount.toLocaleString("th-TH")}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 text-gray-500">
            <FileSpreadsheet className="h-4 w-4" /> บัญชีและสมาชิก
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">{accountCount.toLocaleString("th-TH")}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <Badge variant="info">ใช้งานจริง</Badge>
          <Badge variant="outline">Excel .xlsx</Badge>
        </div>
        <h2 className="mt-3 text-lg font-semibold text-gray-900">ไฟล์ที่ได้จะมี 4 ชีต</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-600">
          <li>summary: สรุปจำนวนข้อมูลและวันที่ส่งออก</li>
          <li>houses: รายการบ้านทั้งหมดพร้อมโซน สถานะ และพิกัด</li>
          <li>people: รายการบุคคลทั้งหมดพร้อมเลขบ้าน วันเกิด เบอร์โทร และสถานะ</li>
          <li>accounts: รายการบัญชีผู้ใช้และ membership ที่ผูกกับหมู่บ้าน</li>
        </ul>
      </div>
    </div>
  );
}
