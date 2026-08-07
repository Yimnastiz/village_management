import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { maskNationalId } from "@/lib/utils";
import { ProfileDetails } from "./profile-details";

function fallback(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "-";
}

function formatDate(value: Date | null | undefined): string {
  if (!value) return "-";

  return new Date(value).toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

  const person =
    (await prisma.person.findUnique({
      where: { userId: user.id },
      include: { house: { select: { houseNumber: true } } },
    })) ??
    (await prisma.person.findFirst({
      where: { phone: user.phoneNumber, villageId: user.registrationVillageId },
      include: { house: { select: { houseNumber: true } } },
      orderBy: { updatedAt: "desc" },
    }));

  const activeMembership =
    user.memberships.find((membership) => membership.status === "ACTIVE") ??
    user.memberships[0] ??
    null;
  const avatarText = (user.name?.trim()?.[0] ?? user.phoneNumber?.[0] ?? "?").toUpperCase();
  const registeredFirstName = fallback(person?.firstName);
  const registeredLastName = fallback(person?.lastName);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">โปรไฟล์</h1>
          <p className="mt-1 text-sm text-gray-500">
            ตรวจสอบข้อมูลบัญชีและข้อมูลทะเบียนของคุณ
          </p>
        </div>
        <Link
          href="/resident/profile/security"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Shield className="h-4 w-4" />
          ความปลอดภัยบัญชี
        </Link>
      </div>

      <ProfileDetails
        user={{
          id: user.id,
          displayName: fallback(user.name),
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
          nationalId: person?.nationalId ?? null,
          maskedNationalId: person?.nationalId ? maskNationalId(person.nationalId) : "-",
        }}
        village={{
          province: fallback(user.registrationProvince),
          district: fallback(user.registrationDistrict),
          subdistrict: fallback(user.registrationSubdistrict),
          registrationVillage: fallback(user.registrationVillage?.name),
          activeVillage: fallback(activeMembership?.village?.name),
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
