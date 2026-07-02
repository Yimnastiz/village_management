import { NextRequest, NextResponse } from "next/server";
import { clearRegistrationCookie, getRegistrationFromRequest } from "@/lib/registration-temp";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const registration = await getRegistrationFromRequest(request);
  if (!registration) {
    return NextResponse.json({ ok: false, error: "No pending registration." }, { status: 404 });
  }

  await prisma.registrationTemp.update({
    where: { id: registration.id },
    data: { status: "CANCELLED" },
  });

  const response = NextResponse.json({ ok: true });
  clearRegistrationCookie(response);
  return response;
}
