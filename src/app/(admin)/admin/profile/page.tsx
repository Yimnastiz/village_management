import { redirect } from "next/navigation";
import { computeLandingPath, getAdminMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { maskNationalId } from "@/lib/utils";
import { ProfileDetails } from "@/app/(resident)/resident/profile/profile-details";

const fallback = (value: string | null | undefined) => value?.trim() || "ยังไม่มีข้อมูล";
const formatDate = (value: Date | null | undefined) => value ? value.toLocaleString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "ยังไม่มีข้อมูล";
export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/admin/profile");
  const membership = getAdminMembership(session);
  if (!membership) redirect(computeLandingPath(session));
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: {
      person: { include: { house: { select: { houseNumber: true } } } },
      memberships: {
        where: { villageId: membership.villageId },
        include: { village: { select: { name: true } }, house: { select: { houseNumber: true } } },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
  if (!user) redirect("/auth/login?callbackUrl=/admin/profile");
  const activeMembership = user.memberships.find((item) => item.status === "ACTIVE") ?? user.memberships[0] ?? null;
  const firstName = fallback(user.person?.firstName); const lastName = fallback(user.person?.lastName);
  const displayName = user.person ? `${firstName} ${lastName}` : fallback(user.name);
  return <ProfileDetails profileArea="admin" user={{ id: user.id, displayName, email: fallback(user.email), rawEmail: user.email ?? "", image: user.image ?? null, phoneNumber: fallback(user.phoneNumber), phoneNumberVerified: user.phoneNumberVerified, emailVerified: user.emailVerified, citizenVerified: Boolean(user.citizenVerifiedAt), accountStatus: user.accountStatus, createdAt: formatDate(user.createdAt), updatedAt: formatDate(user.updatedAt), consentAt: formatDate(user.consentAt), citizenVerifiedAt: formatDate(user.citizenVerifiedAt) }} person={{ firstName, lastName, hasNationalId: Boolean(user.person?.nationalId), maskedNationalId: user.person?.nationalId ? maskNationalId(user.person.nationalId) : "-" }} village={{ province: "-", district: "-", subdistrict: "-", currentVillage: fallback(activeMembership?.village.name), membershipStatus: fallback(activeMembership?.status), membershipRole: fallback(activeMembership?.role), houseNumber: fallback(activeMembership?.house?.houseNumber ?? user.person?.house?.houseNumber) }} avatar={{ text: (displayName.trim()[0] ?? user.phoneNumber[0] ?? "?").toUpperCase(), image: user.image ?? null }} />;
}
