import Link from "next/link";
import { redirect } from "next/navigation";
import { MembershipStatus, PersonStatus } from "@prisma/client";
import { computeLandingPath, getAdminMembership, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { hasVillagePermission } from "@/lib/village-permissions";

export default async function PopulationOverviewPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/admin/population");
  if (!isAdminUser(session)) redirect(computeLandingPath(session));

  const manageableVillageIds = session.memberships
    .filter((membership) => membership.status === MembershipStatus.ACTIVE && hasVillagePermission(membership.role, "population.view"))
    .map((membership) => membership.villageId);
  const overviewWhere = { villageId: { in: manageableVillageIds } };
  const [houseCount, personCount, activeHouseAccountCount, pendingOpeningCount] = await Promise.all([
    prisma.house.count({ where: overviewWhere }),
    prisma.person.count({ where: { ...overviewWhere, status: PersonStatus.ACTIVE } }),
    prisma.residentHouseAccount.count({ where: { ...overviewWhere, activatedAt: { not: null }, suspendedAt: null } }),
    prisma.houseAccountOpeningRequest.count({ where: { ...overviewWhere, status: "PENDING_REVIEW" } }),
  ]);

  const stats = [
    ["บ้านทั้งหมด", houseCount],
    ["ประชากรในทะเบียน", personCount],
    ["บัญชีบ้านที่ใช้งานอยู่", activeHouseAccountCount],
    ["คำขอเปิดบัญชีบ้านรอตรวจสอบ", pendingOpeningCount],
  ] as const;
  const adminMembership = getAdminMembership(session);
  const modules = [
    { title: "ทะเบียนบ้าน", description: "ดู เพิ่ม และจัดการข้อมูลบ้านเลขที่", href: "/admin/population/houses", action: "เปิดทะเบียนบ้าน" },
    { title: "ทะเบียนประชากร", description: "ดู เพิ่ม และแก้ไขข้อมูลประชากร", href: "/admin/population/people", action: "เปิดทะเบียนประชากร" },
    { title: "คำขอเปิดบัญชีบ้าน", description: "ตรวจสอบคำขอเปิดบัญชีสำหรับบ้านในหมู่บ้าน", href: "/admin/population/account-opening-requests", action: pendingOpeningCount ? `${pendingOpeningCount.toLocaleString("th-TH")} รายการรอตรวจสอบ` : "ตรวจสอบคำขอ" },
    ...(adminMembership && hasVillagePermission(adminMembership.role, "population.import")
      ? [{ title: "นำเข้า/ส่งออก", description: "จัดการข้อมูลบ้านและประชากรจำนวนมาก", href: "/admin/population/import", action: "จัดการข้อมูล" }]
      : []),
  ] as const;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">ทะเบียนครัวเรือน</h1>
        <p className="mt-1 text-sm text-gray-500">ภาพรวมข้อมูลบ้าน ประชากร และบัญชีบ้านของหมู่บ้าน</p>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white px-4 py-3.5">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{value.toLocaleString("th-TH")}</p>
          </div>
        ))}
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        {modules.map((module) => (
          <Link key={module.href} href={module.href} className="group flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-4 transition hover:border-gray-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            <div className="min-w-0"><h2 className="font-semibold text-gray-900">{module.title}</h2><p className="mt-1 text-sm text-gray-500">{module.description}</p></div>
            <span className="shrink-0 text-sm font-medium text-blue-700 group-hover:text-blue-800">{module.action} →</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
