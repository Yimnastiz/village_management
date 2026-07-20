import { MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { Download, FileSpreadsheet, Home, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
        <a href="/api/admin/population/export" download>
          <Button>
            <Download className="mr-1 h-4 w-4" /> ดาวน์โหลด Excel
          </Button>
        </a>
        <form action="/api/admin/population/export" method="get" className="flex flex-wrap items-center gap-2">
          <select name="sheets" defaultValue="houses,people,accounts" className="rounded-lg border px-2 py-2 text-sm"><option value="houses,people,accounts">บ้าน บุคคล บัญชี</option><option value="houses">เฉพาะบ้าน</option><option value="people">เฉพาะบุคคล</option><option value="accounts">เฉพาะบัญชี</option></select>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="activeOnly" value="true" /> Active only</label>
          <select name="zoneId" className="rounded-lg border px-2 py-2 text-sm"><option value="">ทุกโซน</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select>
          <select name="status" className="rounded-lg border px-2 py-2 text-sm"><option value="">ทุกสถานะบ้าน</option><option value="OCCUPIED">มีผู้อยู่อาศัย</option><option value="VACANT">ว่าง</option><option value="UNDER_CONSTRUCTION">ก่อสร้าง</option><option value="DEMOLISHED">รื้อถอน</option></select>
          <input type="date" name="from" className="rounded-lg border px-2 py-2 text-sm" /><input type="date" name="to" className="rounded-lg border px-2 py-2 text-sm" />
          <input type="hidden" name="masked" value="true" />
          <Button type="submit"><Download className="mr-1 h-4 w-4" /> ดาวน์โหลด Masked Excel</Button>
        </form>
      </div>

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
