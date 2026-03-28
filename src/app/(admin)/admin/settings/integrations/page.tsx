import { MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { computeLandingPath, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

function yesNoBadge(value: boolean) {
  return <Badge variant={value ? "success" : "warning"}>{value ? "พร้อมใช้งาน" : "ยังไม่ครบ"}</Badge>;
}

export default async function Page() {
  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/admin/settings/integrations");
  if (!isAdminUser(session)) redirect(computeLandingPath(session));

  const membership = await prisma.villageMembership.findFirst({
    where: {
      userId: session.id,
      status: MembershipStatus.ACTIVE,
      role: { in: [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN, VillageMembershipRole.COMMITTEE] },
    },
    select: { villageId: true },
  });
  if (!membership) redirect(computeLandingPath(session));

  const village = await prisma.village.findUnique({
    where: { id: membership.villageId },
    select: { slug: true },
  });

  const dbOk = await prisma.village.count().then(() => true).catch(() => false);
  const s3Configured = Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_REGION &&
      process.env.AWS_S3_BUCKET,
  );
  const authConfigured = Boolean(process.env.BETTER_AUTH_SECRET);
  const devHeadmanLoginEnabled = process.env.NODE_ENV !== "production";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">การเชื่อมต่อ</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-900">ฐานข้อมูล PostgreSQL</p>
          <div className="mt-2">{yesNoBadge(dbOk)}</div>
          <p className="mt-2 text-xs text-gray-500">ระบบทดสอบ query จริงก่อนแสดงผลหน้านี้</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-900">Object Storage (S3)</p>
          <div className="mt-2">{yesNoBadge(s3Configured)}</div>
          <p className="mt-2 text-xs text-gray-500">ตรวจสอบจาก AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-900">ระบบยืนยันตัวตน Better Auth</p>
          <div className="mt-2">{yesNoBadge(authConfigured)}</div>
          <p className="mt-2 text-xs text-gray-500">ตรวจสอบจาก BETTER_AUTH_SECRET</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-900">โหมดทดสอบผู้ใหญ่บ้าน</p>
          <div className="mt-2">{yesNoBadge(devHeadmanLoginEnabled)}</div>
          <p className="mt-2 text-xs text-gray-500">เปิดใช้เฉพาะโหมดพัฒนาเท่านั้น</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-sm font-medium text-gray-900">Endpoint ที่ใช้ร่วมระบบภายนอก</p>
        <div className="mt-3 space-y-2 text-sm text-gray-700">
          <p>Auth callback: /api/auth/[...all]</p>
          <p>Post-login route: /api/auth/post-login-route</p>
          <p>หมู่บ้านสาธารณะ: /{village?.slug ?? "{villageSlug}"}</p>
          <p>Template import ประชากร: /api/admin/population/import-template</p>
          <p>Export ประชากร: /api/admin/population/export</p>
        </div>
      </div>
    </div>
  );
}
