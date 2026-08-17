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
  return <VillageSettingsForm village={village} />;
}
