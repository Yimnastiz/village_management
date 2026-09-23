import { AccountKind, AccountStatus, MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveAuthRedirectPathFromRequest } from "@/lib/access-control";
import { getConfiguredVillage } from "@/lib/configured-village";
import { prisma } from "@/lib/prisma";
import { toPhoneCandidates } from "@/lib/registration-temp";

const checkRegistrationSchema = z.object({ phoneNumber: z.string().trim().min(1) });

export async function POST(request: NextRequest) {
  const landingPath = await getActiveAuthRedirectPathFromRequest(request);
  if (landingPath) {
    return NextResponse.json({ error: "Already signed in. Please log out before signing in with another account.", landingPath }, { status: 409 });
  }
  const parsed = checkRegistrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const candidates = toPhoneCandidates(parsed.data.phoneNumber);
  if (candidates.length === 0) return NextResponse.json({ error: "Phone number must be exactly 10 digits." }, { status: 400 });

  const village = await getConfiguredVillage();
  const user = await prisma.user.findFirst({
    where: {
      phoneNumber: { in: candidates },
      OR: [{ accountKind: AccountKind.HEADMAN }, { accountKind: null }],
      accountStatus: AccountStatus.ACTIVE,
      memberships: { some: { villageId: village.id, role: VillageMembershipRole.HEADMAN, status: MembershipStatus.ACTIVE } },
    },
    select: { id: true, phoneNumber: true },
  });
  if (!user) return NextResponse.json({ error: "ไม่พบบัญชีผู้ใหญ่บ้านที่ใช้งานได้สำหรับเบอร์โทรศัพท์นี้" }, { status: 404 });
  return NextResponse.json({ registered: true, phoneNumber: user.phoneNumber, userId: user.id });
}
