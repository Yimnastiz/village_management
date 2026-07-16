import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AccountStatus, RegistrationTempStatus } from "@prisma/client";
import { toPhoneCandidates } from "@/lib/registration-temp";

const checkRegistrationSchema = z.object({
  phoneNumber: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = checkRegistrationSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const candidates = toPhoneCandidates(parsed.data.phoneNumber);
  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "Phone number must be exactly 10 digits." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findFirst({
    where: {
      phoneNumber: {
        in: candidates,
      },
      accountStatus: AccountStatus.ACTIVE,
    },
    select: {
      id: true,
      phoneNumber: true,
    },
  });

  if (!user) {
    const pendingRegistration = await prisma.registrationTemp.findFirst({
      where: {
        phoneNumber: { in: candidates },
        status: RegistrationTempStatus.WAITING_OTP,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, expiresAt: true, otpLockedUntil: true },
      orderBy: { updatedAt: "desc" },
    });

    if (pendingRegistration) {
      const pendingRegistrationLockedUntil = pendingRegistration.otpLockedUntil
        ? pendingRegistration.otpLockedUntil.toISOString()
        : null;

      return NextResponse.json({
        registered: false,
        pendingRegistrationId: pendingRegistration.id,
        pendingRegistrationExpiresAt: pendingRegistration.expiresAt.toISOString(),
        pendingRegistrationLockedUntil,
      });
    }

    return NextResponse.json(
      {
        error:
          "This phone number is not registered yet. Please register before logging in or requesting binding.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    registered: true,
    phoneNumber: user.phoneNumber,
    userId: user.id,
  });
}
