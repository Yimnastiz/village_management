import { randomUUID } from "node:crypto";
import { MembershipStatus, SystemRole, VillageMembershipRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { computeLandingPath, SESSION_COOKIE } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

function normalizePhoneNumber(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

export async function POST(request: NextRequest) {
  const isEnabled = process.env.DEV_BYPASS_OTP_HEADMAN === "true";
  if (!isEnabled) {
    return NextResponse.json(
      { error: "Headman OTP bypass is disabled." },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { phoneNumber?: string }
    | null;

  const phoneNumber = normalizePhoneNumber(body?.phoneNumber?.trim() ?? "");
  if (!phoneNumber) {
    return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
  }

  const seed = await prisma.phoneRoleSeed.findUnique({
    where: { phoneNumber },
    include: {
      village: {
        select: {
          id: true,
          slug: true,
        },
      },
    },
  });

  if (!seed || !seed.villageId || seed.membershipRole !== VillageMembershipRole.HEADMAN) {
    return NextResponse.json(
      { error: "This phone is not configured as HEADMAN." },
      { status: 404 }
    );
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const user = await prisma.user.upsert({
    where: { phoneNumber },
    update: {
      phoneNumberVerified: true,
      systemRole: seed.systemRole ?? SystemRole.USER,
      citizenVerifiedAt: seed.isCitizenVerified ? now : null,
      registrationVillageId: seed.villageId,
      name: phoneNumber,
    },
    create: {
      phoneNumber,
      phoneNumberVerified: true,
      systemRole: seed.systemRole ?? SystemRole.USER,
      citizenVerifiedAt: seed.isCitizenVerified ? now : null,
      registrationVillageId: seed.villageId,
      name: phoneNumber,
    },
  });

  await prisma.villageMembership.upsert({
    where: {
      userId_villageId: {
        userId: user.id,
        villageId: seed.villageId,
      },
    },
    update: {
      role: VillageMembershipRole.HEADMAN,
      status: MembershipStatus.ACTIVE,
      joinedAt: now,
    },
    create: {
      userId: user.id,
      villageId: seed.villageId,
      role: VillageMembershipRole.HEADMAN,
      status: MembershipStatus.ACTIVE,
      joinedAt: now,
    },
  });

  const token = randomUUID();
  await prisma.authSession.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
      createdAt: now,
      updatedAt: now,
      activeVillageId: seed.villageId,
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: request.headers.get("user-agent"),
    },
  });

  const landingPath = computeLandingPath({
    id: user.id,
    name: user.name,
    phoneNumber: user.phoneNumber,
    systemRole: user.systemRole,
    citizenVerifiedAt: user.citizenVerifiedAt,
    memberships: [
      {
        villageId: seed.villageId,
        villageSlug: seed.village?.slug ?? null,
        role: VillageMembershipRole.HEADMAN,
        status: MembershipStatus.ACTIVE,
      },
    ],
  });

  const response = NextResponse.json({
    success: true,
    landingPath,
    villageId: seed.villageId,
    villageSlug: seed.village?.slug ?? null,
  });

  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return response;
}

