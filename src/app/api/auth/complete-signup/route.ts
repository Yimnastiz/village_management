import { MembershipStatus, SystemRole, VillageMembershipRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { computeLandingPath, getSessionContextFromRequest } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

const completeSignupSchema = z.object({
  name: z.string().trim().min(1),
  nationalId: z.string().trim().regex(/^\d{13}$/),
  registrationMode: z.enum(["resident", "headman"]).default("resident"),
  province: z.string().trim().min(1),
  district: z.string().trim().min(1),
  subdistrict: z.string().trim().min(1),
  villageId: z.string().trim().min(1),
});

function splitDisplayName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: "ไม่ระบุ", lastName: "-" };
  }

  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] ?? "ไม่ระบุ",
    lastName: parts.slice(1).join(" ") || "-",
  };
}

export async function POST(request: NextRequest) {
  const session = await getSessionContextFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = completeSignupSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid signup payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, nationalId, registrationMode, province, district, subdistrict, villageId } = parsed.data;

  const selectedVillage = await prisma.village.findUnique({
    where: { id: villageId },
    select: {
      id: true,
      province: true,
      district: true,
      subdistrict: true,
    },
  });

  if (!selectedVillage) {
    return NextResponse.json({ error: "Village not found" }, { status: 404 });
  }

  const phoneSeed = await prisma.phoneRoleSeed.findUnique({
    where: { phoneNumber: session.phoneNumber },
  });

  let resolvedVillageId = phoneSeed?.villageId ?? villageId;
  let resolvedMembershipRole = phoneSeed?.membershipRole ?? VillageMembershipRole.RESIDENT;
  let resolvedMembershipStatus = phoneSeed
    ? MembershipStatus.ACTIVE
    : MembershipStatus.PENDING;
  let resolvedSystemRole =
    phoneSeed?.systemRole ??
    (session.systemRole === SystemRole.SUPERADMIN ? SystemRole.SUPERADMIN : undefined);
  let isCitizenVerified = phoneSeed?.isCitizenVerified ?? false;

  if (registrationMode === "headman") {
    if (
      selectedVillage.province !== province ||
      selectedVillage.district !== district ||
      selectedVillage.subdistrict !== subdistrict
    ) {
      return NextResponse.json(
        { error: "ข้อมูลพื้นที่ไม่ตรงกับหมู่บ้านที่เลือก" },
        { status: 400 },
      );
    }

    const matchedPerson = await prisma.person.findFirst({
      where: {
        villageId,
        nationalId,
        phone: session.phoneNumber,
      },
      select: { id: true },
    });

    if (!matchedPerson) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลผู้ใหญ่บ้าน/กรรมการที่ตรงกับเลขบัตรและเบอร์โทรในทะเบียนกลาง" },
        { status: 403 },
      );
    }

    const activeHeadman = await prisma.villageMembership.findFirst({
      where: {
        villageId,
        role: VillageMembershipRole.HEADMAN,
        status: MembershipStatus.ACTIVE,
        userId: { not: session.id },
      },
      select: { id: true },
    });

    if (activeHeadman) {
      return NextResponse.json(
        { error: "หมู่บ้านนี้มีผู้ใหญ่บ้านใช้งานอยู่แล้ว กรุณาติดต่อผู้ดูแลระบบ" },
        { status: 409 },
      );
    }

    resolvedVillageId = villageId;
    resolvedMembershipRole = VillageMembershipRole.HEADMAN;
    resolvedMembershipStatus = MembershipStatus.ACTIVE;
    resolvedSystemRole = SystemRole.USER;
    isCitizenVerified = true;

    await prisma.phoneRoleSeed.upsert({
      where: { phoneNumber: session.phoneNumber },
      update: {
        villageId,
        membershipRole: VillageMembershipRole.HEADMAN,
        systemRole: null,
        isCitizenVerified: true,
        note: "Onboarded from headman registration flow",
      },
      create: {
        phoneNumber: session.phoneNumber,
        villageId,
        membershipRole: VillageMembershipRole.HEADMAN,
        systemRole: null,
        isCitizenVerified: true,
        note: "Onboarded from headman registration flow",
      },
    });
  }

  await prisma.user.update({
    where: { id: session.id },
    data: {
      name,
      systemRole: resolvedSystemRole,
      registrationProvince: province,
      registrationDistrict: district,
      registrationSubdistrict: subdistrict,
      registrationVillageId: villageId,
      citizenVerifiedAt: isCitizenVerified ? new Date() : null,
      consentAt: new Date(),
    },
  });

  await prisma.villageMembership.upsert({
    where: {
      userId_villageId: {
        userId: session.id,
        villageId: resolvedVillageId,
      },
    },
    update: {
      role: resolvedMembershipRole,
      status: resolvedMembershipStatus,
      joinedAt: resolvedMembershipStatus === MembershipStatus.ACTIVE ? new Date() : null,
    },
    create: {
      userId: session.id,
      villageId: resolvedVillageId,
      role: resolvedMembershipRole,
      status: resolvedMembershipStatus,
      joinedAt: resolvedMembershipStatus === MembershipStatus.ACTIVE ? new Date() : null,
    },
  });

  const personName = splitDisplayName(name);
  const existingPerson = await prisma.person.findFirst({
    where: {
      OR: [
        { nationalId },
        { phone: session.phoneNumber, villageId: resolvedVillageId },
      ],
    },
    select: { id: true },
  });

  if (existingPerson) {
    await prisma.person.update({
      where: { id: existingPerson.id },
      data: {
        villageId: resolvedVillageId,
        nationalId,
        firstName: personName.firstName,
        lastName: personName.lastName,
        phone: session.phoneNumber,
      },
    });
  } else {
    await prisma.person.create({
      data: {
        villageId: resolvedVillageId,
        nationalId,
        firstName: personName.firstName,
        lastName: personName.lastName,
        phone: session.phoneNumber,
      },
    });
  }

  // Signup should not create a binding request automatically.
  // Remove any legacy auto-created pending requests created by older flows.
  await prisma.bindingRequest.deleteMany({
    where: {
      userId: session.id,
      status: "PENDING",
      note: "Auto-created from signup flow.",
      reviewedBy: null,
      reviewedAt: null,
    },
  });

  const refreshedSession = await getSessionContextFromRequest(request);

  if (!refreshedSession) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  return NextResponse.json({
    landingPath: computeLandingPath(refreshedSession),
    citizenVerified: Boolean(refreshedSession.citizenVerifiedAt),
    assignedRole: resolvedMembershipRole,
    membershipStatus: resolvedMembershipStatus,
    assignedVillageId: resolvedVillageId,
  });
}
