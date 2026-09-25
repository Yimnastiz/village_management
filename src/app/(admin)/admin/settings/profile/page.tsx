import { redirect } from "next/navigation";
import { MEMBERSHIP_ROLE_LABELS } from "@/lib/constants";
import { computeLandingPath, getAdminMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { PersonalSettings } from "./personal-settings";

export default async function Page() {
  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/admin/settings/profile");
  const membership = getAdminMembership(session); if (!membership) redirect(computeLandingPath(session));
  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { name: true, phoneNumber: true, email: true, image: true, memberships: { where: { villageId: membership.villageId }, select: { role: true, house: { select: { houseNumber: true } } }, take: 1 } } });
  if (!user) redirect("/auth/login"); const ownMembership = user.memberships[0];
  return <PersonalSettings profile={{ name: user.name, firstName: null, lastName: null, phone: user.phoneNumber ?? "", email: user.email, image: user.image, role: ownMembership ? MEMBERSHIP_ROLE_LABELS[ownMembership.role] : "-", houseNumber: ownMembership?.house?.houseNumber ?? null }} />;
}
