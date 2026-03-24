import Link from "next/link";
import { ArrowLeft, User } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { MembershipStatus } from "@prisma/client";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { MEMBERSHIP_ROLE_LABELS } from "@/lib/constants";
import { formatThaiDate } from "@/lib/utils";

const GENDER_LABELS: Record<string, string> = {
  MALE: "ชาย",
  FEMALE: "หญิง",
  M: "ชาย",
  F: "หญิง",
  male: "ชาย",
  female: "หญิง",
};

function maskThaiNationalId(id: string): string {
  const clean = id.replace(/\D/g, "");
  if (clean.length === 13) {
    // Format: *-****-*****-XX-X (show last 3: positions 10,11,12)
    return `*-****-*****-${clean[10]}${clean[11]}-${clean[12]}`;
  }
  // Fallback: mask all but last 3
  return "*".repeat(Math.max(0, clean.length - 3)) + clean.slice(-3);
}

function calculateAge(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

interface PageProps {
  params: Promise<{ memberId: string }>;
}

export default async function MemberDetailPage({ params }: PageProps) {
  const { memberId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const residency = getResidentMembership(session);

  // Get the current user's primary active house
  const primaryHouse = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: MembershipStatus.ACTIVE },
    orderBy: { updatedAt: "desc" },
    select: { houseId: true },
  });

  const effectiveHouseId = residency?.houseId ?? primaryHouse?.houseId;
  if (!effectiveHouseId) notFound();

  // Parse memberId: format is "person-{id}" or "membership-{id}"
  const dashIdx = memberId.indexOf("-");
  if (dashIdx === -1) notFound();
  const type = memberId.slice(0, dashIdx);
  const actualId = memberId.slice(dashIdx + 1);

  type MemberData = {
    name: string;
    firstName?: string | null;
    lastName?: string | null;
    dateOfBirth?: Date | null;
    gender?: string | null;
    nationalId?: string | null;
    phone?: string | null;
    email?: string | null;
    profilePhoto?: string | null;
    houseNumber?: string | null;
    role?: string | null;
    source: string;
  };

  let memberData: MemberData | null = null;

  if (type === "person") {
    const person = await prisma.person.findFirst({
      where: { id: actualId, houseId: effectiveHouseId },
      select: {
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        nationalId: true,
        phone: true,
        email: true,
        profilePhoto: true,
        house: { select: { houseNumber: true } },
      },
    });
    if (!person) notFound();
    memberData = {
      name: `${person.firstName} ${person.lastName}`.trim(),
      firstName: person.firstName,
      lastName: person.lastName,
      dateOfBirth: person.dateOfBirth,
      gender: person.gender,
      nationalId: person.nationalId,
      phone: person.phone,
      email: person.email,
      profilePhoto: person.profilePhoto,
      houseNumber: person.house?.houseNumber,
      source: "ทะเบียนบุคคล",
    };
  } else if (type === "membership") {
    const membership = await prisma.villageMembership.findFirst({
      where: { id: actualId, houseId: effectiveHouseId, status: MembershipStatus.ACTIVE },
      include: {
        user: { select: { name: true, phoneNumber: true, email: true, image: true } },
        house: { select: { houseNumber: true } },
      },
    });
    if (!membership) notFound();
    memberData = {
      name: membership.user.name,
      phone: membership.user.phoneNumber,
      email: membership.user.email,
      profilePhoto: membership.user.image,
      houseNumber: membership.house?.houseNumber,
      role: membership.role,
      source: "ผู้ใช้งานระบบ",
    };
  } else {
    notFound();
  }

  const age = memberData.dateOfBirth ? calculateAge(memberData.dateOfBirth) : null;

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/resident/household"
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> กลับข้อมูลครัวเรือน
      </Link>

      <div className="rounded-xl border border-gray-200 bg-white p-8">
        {/* Profile header */}
        <div className="mb-8 flex items-center gap-5 border-b pb-6">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gray-100">
            {memberData.profilePhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={memberData.profilePhoto}
                alt={memberData.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-10 w-10 text-gray-400" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{memberData.name || "-"}</h1>
            <p className="mt-1 text-sm text-gray-500">{memberData.source}</p>
          </div>
        </div>

        {/* Info grid */}
        <dl className="grid grid-cols-1 gap-x-8 gap-y-5 text-sm md:grid-cols-2">
          {memberData.firstName && (
            <div>
              <dt className="text-gray-500">ชื่อ</dt>
              <dd className="mt-0.5 font-medium text-gray-900">{memberData.firstName}</dd>
            </div>
          )}
          {memberData.lastName && (
            <div>
              <dt className="text-gray-500">นามสกุล</dt>
              <dd className="mt-0.5 font-medium text-gray-900">{memberData.lastName}</dd>
            </div>
          )}
          {memberData.dateOfBirth && (
            <div>
              <dt className="text-gray-500">วันเกิด</dt>
              <dd className="mt-0.5 font-medium text-gray-900">
                {formatThaiDate(memberData.dateOfBirth)}
              </dd>
            </div>
          )}
          {age !== null && (
            <div>
              <dt className="text-gray-500">อายุ</dt>
              <dd className="mt-0.5 font-medium text-gray-900">{age} ปี</dd>
            </div>
          )}
          {memberData.nationalId && (
            <div>
              <dt className="text-gray-500">เลขบัตรประชาชน</dt>
              <dd className="mt-0.5 font-mono font-medium tracking-widest text-gray-900">
                {maskThaiNationalId(memberData.nationalId)}
              </dd>
            </div>
          )}
          {memberData.gender && (
            <div>
              <dt className="text-gray-500">เพศ</dt>
              <dd className="mt-0.5 font-medium text-gray-900">
                {GENDER_LABELS[memberData.gender] ?? memberData.gender}
              </dd>
            </div>
          )}
          {memberData.phone && (
            <div>
              <dt className="text-gray-500">เบอร์โทรศัพท์</dt>
              <dd className="mt-0.5 font-medium text-gray-900">{memberData.phone}</dd>
            </div>
          )}
          {memberData.email && (
            <div>
              <dt className="text-gray-500">อีเมล</dt>
              <dd className="mt-0.5 font-medium text-gray-900">{memberData.email}</dd>
            </div>
          )}
          {memberData.houseNumber && (
            <div>
              <dt className="text-gray-500">บ้านเลขที่</dt>
              <dd className="mt-0.5 font-medium text-gray-900">{memberData.houseNumber}</dd>
            </div>
          )}
          {memberData.role && (
            <div>
              <dt className="text-gray-500">บทบาทในระบบ</dt>
              <dd className="mt-0.5 font-medium text-gray-900">
                {MEMBERSHIP_ROLE_LABELS[memberData.role] ?? memberData.role}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}

