import { redirect } from "next/navigation";
import { computeLandingPath, getAdminMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { VillageSettingsForm } from "./village-settings-form";

export default async function Page() {
  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/admin/settings/village");
  const membership = getAdminMembership(session);
  if (!membership) redirect(computeLandingPath(session));
  const village = await prisma.village.findUnique({ where: { id: membership.villageId }, select: { name: true, slug: true, moo: true, province: true, district: true, subdistrict: true, description: true, address: true, phone: true, email: true, website: true } });
  if (!village) redirect(computeLandingPath(session));
  return <div className="mx-auto max-w-4xl space-y-2"><h1 className="text-2xl font-bold text-gray-900">ตั้งค่าหมู่บ้าน</h1><p className="text-sm text-gray-500">จัดการรายละเอียดติดต่อของหมู่บ้าน</p><VillageSettingsForm village={village} /></div>;
}
