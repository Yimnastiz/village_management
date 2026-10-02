import { redirect } from "next/navigation";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { normalizeAccountEmail } from "@/lib/account-email";
import { requireHouseAccountEmailContext } from "@/lib/house-account-email-management-service";
import { prisma } from "@/lib/prisma";
import { PageBackLink } from "@/components/ui/page-back-link";
import { HouseAccountEmailManager } from "./house-account-email-manager";

export const dynamic = "force-dynamic";

export default async function ProfileSecurityPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/resident/profile/security");
  if (session.accountKind !== "RESIDENT_HOUSE") redirect("/resident/profile");
  const context = await requireHouseAccountEmailContext(session).catch(() => null);
  if (!context) redirect("/resident/dashboard");
  const [user, aliases] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.id }, select: { email: true } }),
    prisma.accountEmail.findMany({ where: { residentHouseAccountId: context.residentHouseAccountId, userId: session.id, status: "ACTIVE" }, orderBy: [{ activatedAt: "asc" }, { createdAt: "asc" }], select: { id: true, email: true, normalizedEmail: true } }),
  ]);
  const canonical = user?.email ? normalizeAccountEmail(user.email) : null;
  return <div className="mx-auto max-w-3xl space-y-6"><PageBackLink href="/resident/profile" label="กลับไปโปรไฟล์" /><header><h1 className="text-2xl font-bold text-gray-900">อีเมลสำหรับเข้าสู่ระบบ</h1><p className="mt-2 text-sm text-gray-600">จัดการอีเมลที่สามารถใช้เข้าสู่บัญชีบ้านนี้</p></header><HouseAccountEmailManager emails={aliases.map((alias) => ({ id: alias.id, email: alias.email, isCanonical: alias.normalizedEmail === canonical, isCurrentSession: alias.id === session.loginAccountEmailId }))} /></div>;
}
