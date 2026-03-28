import Link from "next/link";
import { MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { Building2, KeyRound, Link2, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { computeLandingPath, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

const ADMIN_MEMBERSHIP_ROLES = new Set<VillageMembershipRole>([
  VillageMembershipRole.HEADMAN,
  VillageMembershipRole.ASSISTANT_HEADMAN,
  VillageMembershipRole.COMMITTEE,
]);

export default async function Page() {
  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/admin/settings");
  if (!isAdminUser(session)) redirect(computeLandingPath(session));

  const membership = await prisma.villageMembership.findFirst({
    where: {
      userId: session.id,
      status: MembershipStatus.ACTIVE,
      role: { in: [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN, VillageMembershipRole.COMMITTEE] },
    },
    select: { villageId: true, role: true },
  });
  if (!membership) redirect(computeLandingPath(session));

  const [village, memberCount, adminCount, pendingBindings] = await Promise.all([
    prisma.village.findUnique({
      where: { id: membership.villageId },
      select: { name: true, slug: true, updatedAt: true, isActive: true },
    }),
    prisma.villageMembership.count({
      where: { villageId: membership.villageId, status: MembershipStatus.ACTIVE },
    }),
    prisma.villageMembership.count({
      where: {
        villageId: membership.villageId,
        status: MembershipStatus.ACTIVE,
        role: { in: [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN, VillageMembershipRole.COMMITTEE] },
      },
    }),
    prisma.bindingRequest.count({
      where: { villageId: membership.villageId, status: "PENDING" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ตั้งค่าระบบผู้ดูแล</h1>
        <p className="mt-1 text-sm text-gray-500">จัดการข้อมูลหมู่บ้าน สิทธิ์การเข้าถึง และสถานะการเชื่อมต่อระบบ</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs text-gray-500">หมู่บ้าน</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{village?.name ?? "-"}</p>
          <p className="mt-2 text-xs text-gray-500">slug: {village?.slug ?? "-"}</p>
          <Badge variant={village?.isActive ? "success" : "danger"} className="mt-3">
            {village?.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
          </Badge>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs text-gray-500">สมาชิกใช้งานอยู่</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{memberCount.toLocaleString("th-TH")}</p>
          <p className="mt-2 text-xs text-gray-500">ผู้ดูแล {adminCount.toLocaleString("th-TH")} คน</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs text-gray-500">คำขอรอพิจารณา</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{pendingBindings.toLocaleString("th-TH")}</p>
          <Link href="/admin/population" className="mt-2 inline-block text-xs text-blue-600 hover:underline">
            ไปหน้าทะเบียนครัวเรือน
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/admin/settings/village" className="rounded-xl border border-gray-200 bg-white p-5 hover:border-blue-300 hover:bg-blue-50/30">
          <div className="flex items-center gap-2 text-gray-700">
            <Building2 className="h-4 w-4" />
            <p className="font-medium">ข้อมูลหมู่บ้าน</p>
          </div>
          <p className="mt-2 text-sm text-gray-500">แก้ไขชื่อ ที่อยู่ โลโก้ ข้อมูลติดต่อ และสถานะการเปิดใช้งาน</p>
        </Link>
        <Link href="/admin/settings/roles" className="rounded-xl border border-gray-200 bg-white p-5 hover:border-blue-300 hover:bg-blue-50/30">
          <div className="flex items-center gap-2 text-gray-700">
            <ShieldCheck className="h-4 w-4" />
            <p className="font-medium">สิทธิ์ผู้ใช้งาน</p>
          </div>
          <p className="mt-2 text-sm text-gray-500">ปรับ role และสถานะของสมาชิกให้เหมาะกับการบริหารหมู่บ้าน</p>
        </Link>
        <Link href="/admin/settings/integrations" className="rounded-xl border border-gray-200 bg-white p-5 hover:border-blue-300 hover:bg-blue-50/30">
          <div className="flex items-center gap-2 text-gray-700">
            <Link2 className="h-4 w-4" />
            <p className="font-medium">การเชื่อมต่อระบบ</p>
          </div>
          <p className="mt-2 text-sm text-gray-500">ตรวจสอบสถานะฐานข้อมูล เก็บไฟล์ และ endpoint ที่ใช้งานจริง</p>
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-900">การอัปเดตล่าสุดของข้อมูลหมู่บ้าน</p>
            <p className="text-xs text-gray-500">ใช้เป็นจุดตรวจสุขภาพข้อมูลก่อน export/import และเปิดใช้งานบริการต่าง ๆ</p>
          </div>
          <Link
            href="/admin/settings/village"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <KeyRound className="mr-1 h-4 w-4" /> จัดการทันที
          </Link>
        </div>
        <p className="mt-3 text-sm text-gray-600">
          {village?.updatedAt
            ? `แก้ไขล่าสุดเมื่อ ${village.updatedAt.toLocaleString("th-TH")}`
            : "ยังไม่มีข้อมูลเวลาอัปเดต"}
        </p>
      </div>
    </div>
  );
}
