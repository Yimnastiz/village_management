import { MembershipStatus, SystemRole, VillageMembershipRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { computeLandingPath, getSessionContextFromRequest } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

const completeSignupSchema = z.object({
  name: z.string().trim().min(1),
  province: z.string().trim().min(1),
  district: z.string().trim().min(1),
  subdistrict: z.string().trim().min(1),
  villageId: z.string().trim().min(1),
});

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

  const { name, province, district, subdistrict, villageId } = parsed.data;

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

  const resolvedSystemRole =
    phoneSeed?.systemRole ??
    (session.systemRole === SystemRole.SUPERADMIN ? SystemRole.SUPERADMIN : undefined);

  const isCitizenVerified = phoneSeed?.isCitizenVerified ?? false;
  const resolvedVillageId = phoneSeed?.villageId ?? villageId;
  const resolvedMembershipRole = phoneSeed?.membershipRole ?? VillageMembershipRole.RESIDENT;
  const resolvedMembershipStatus = phoneSeed
    ? MembershipStatus.ACTIVE
    : MembershipStatus.PENDING;

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
