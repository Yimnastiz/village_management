import { AccountDeletionCard } from "./account-deletion-card";
import { redirect } from "next/navigation";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { normalizeAccountEmail } from "@/lib/account-email";
import { requireHouseAccountEmailContext } from "@/lib/house-account-email-management-service";
import { prisma } from "@/lib/prisma";
import { HouseAccountEmailManager } from "./house-account-email-manager";

export const dynamic = "force-dynamic";

export default async function ProfileSecurityPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/resident/profile/security");

  if (session.accountKind === "RESIDENT_HOUSE") {
    const context = await requireHouseAccountEmailContext(session).catch(() => null);
    if (!context) redirect("/resident/dashboard");
    const [user, aliases] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.id }, select: { email: true } }),
      prisma.accountEmail.findMany({
        where: { residentHouseAccountId: context.residentHouseAccountId, userId: session.id, status: "ACTIVE" },
        orderBy: [{ activatedAt: "asc" }, { createdAt: "asc" }],
        select: { id: true, email: true, normalizedEmail: true },
      }),
    ]);
    const canonical = user?.email ? normalizeAccountEmail(user.email) : null;
    return <div className="space-y-6"><h1 className="text-2xl font-bold text-gray-900">ความปลอดภัยบัญชี</h1><HouseAccountEmailManager emails={aliases.map((alias) => ({ id: alias.id, email: alias.email, isCanonical: alias.normalizedEmail === canonical, isCurrentSession: alias.id === session.loginAccountEmailId }))} /><div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6"><h2 className="font-semibold text-gray-900">ข้อมูลความปลอดภัยและเซสชัน</h2><p className="mt-1 text-sm text-gray-500">เซสชันที่เข้าสู่ระบบด้วยอีเมลซึ่งถูกนำออกจะถูกเพิกถอนโดยอัตโนมัติ</p></div><section className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-6"><h2 className="font-semibold text-amber-900">การจัดการบัญชีบ้าน</h2><p className="mt-1 text-sm leading-6 text-amber-800">หากต้องการยกเลิกบัญชีบ้านหรือไม่สามารถเข้าถึงอีเมลเดิมได้ กรุณาติดต่อผู้ใหญ่บ้าน</p></section></div>;
  }

  return <div className="space-y-6"><h1 className="text-2xl font-bold text-gray-900">ความปลอดภัยบัญชี</h1><div className="bg-white rounded-xl border border-gray-200 p-6"><p className="text-gray-500">จัดการอุปกรณ์และ session ที่เข้าสู่ระบบ</p></div><AccountDeletionCard /></div>;
}
