import { redirect } from "next/navigation";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { maskNationalId } from "@/lib/utils";
import { normalizePersonGender } from "@/lib/person-validation";
import { ProfileDetails } from "./profile-details";

function fallback(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "ยังไม่มีข้อมูล";
}

function formatDate(value: Date | null | undefined): string {
  if (!value) return "ยังไม่มีข้อมูล";

  return new Date(value).toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBirthDate(value: Date | null | undefined): string {
  if (!value) return "ยังไม่มีข้อมูล";
  return new Date(value).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
}

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getSessionContextFromServerCookies();
  if (!session) {
    redirect("/auth/login?callbackUrl=/resident/profile");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: {
      registrationVillage: {
        select: {
          name: true,
        },
      },
      memberships: {
        include: {
          village: {
            select: {
              name: true,
            },
          },
          house: {
            select: {
              houseNumber: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!user) {
    redirect("/auth/login?callbackUrl=/resident/profile");
  }

  const [person, registration] = await Promise.all([
    prisma.person.findUnique({
      where: { userId: user.id },
      include: { house: { select: { houseNumber: true } } },
    }),
    prisma.registrationTemp.findFirst({
      where: {
        phoneNumber: user.phoneNumber,
        status: "VERIFIED",
        ...(user.registrationVillageId ? { villageId: user.registrationVillageId } : {}),
      },
      orderBy: { updatedAt: "desc" },
      select: { firstName: true, lastName: true, nationalId: true, dateOfBirth: true, gender: true },
    }),
  ]);

  const activeMembership =
    user.memberships.find((membership) => membership.status === "ACTIVE") ??
    user.memberships[0] ??
    null;
  const registeredFirstName = fallback(person?.firstName ?? registration?.firstName);
  const registeredLastName = fallback(person?.lastName ?? registration?.lastName);
  const legalName = person ? `${registeredFirstName} ${registeredLastName}` : fallback(user.name);
  const avatarText = (legalName.trim()?.[0] ?? user.phoneNumber?.[0] ?? "?").toUpperCase();

  return (
    <div className="space-y-5">
      <ProfileDetails
        user={{
          id: user.id,
          displayName: legalName,
          email: fallback(user.email),
          rawEmail: user.email ?? "",
          image: user.image ?? null,
          phoneNumber: fallback(user.phoneNumber),
          phoneNumberVerified: user.phoneNumberVerified,
          emailVerified: user.emailVerified,
          citizenVerified: Boolean(user.citizenVerifiedAt),
          accountStatus: user.accountStatus,
          createdAt: formatDate(user.createdAt),
          updatedAt: formatDate(user.updatedAt),
          consentAt: formatDate(user.consentAt),
          citizenVerifiedAt: formatDate(user.citizenVerifiedAt),
        }}
        person={{
          firstName: registeredFirstName,
          lastName: registeredLastName,
          hasNationalId: Boolean(person?.nationalId ?? registration?.nationalId),
          maskedNationalId: person?.nationalId || registration?.nationalId ? maskNationalId(person?.nationalId ?? registration?.nationalId ?? "") : "-",
          dateOfBirth: formatBirthDate(person?.dateOfBirth ?? registration?.dateOfBirth),
          gender: person?.gender || registration?.gender ? normalizePersonGender(person?.gender ?? registration?.gender) ?? "ยังไม่มีข้อมูล" : "ยังไม่มีข้อมูล",
        }}
        village={{
          province: fallback(user.registrationProvince),
          district: fallback(user.registrationDistrict),
          subdistrict: fallback(user.registrationSubdistrict),
          currentVillage: fallback(activeMembership?.village?.name ?? user.registrationVillage?.name),
          membershipStatus: fallback(activeMembership?.status),
          membershipRole: fallback(activeMembership?.role),
          houseNumber: fallback(activeMembership?.house?.houseNumber ?? person?.house?.houseNumber),
        }}
        avatar={{
          text: avatarText,
          image: user.image ?? null,
        }}
      />
    </div>
  );
}
