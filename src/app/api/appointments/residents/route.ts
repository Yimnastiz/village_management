import { NextRequest, NextResponse } from "next/server";
import { AccountKind } from "@prisma/client";
import { getAdminMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { hasVillagePermission } from "@/lib/village-permissions";
import { RESIDENT_ACTOR_USER_SELECT, residentActorDisplay } from "@/lib/resident-actor-display";

export async function GET(request: NextRequest) {
  const session = await getSessionContextFromServerCookies();
  const membership = session ? getAdminMembership(session) : null;
  if (!membership || !hasVillagePermission(membership.role, "appointments.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const residents = await prisma.user.findMany({
    where: {
      OR: [
        { memberships: { some: { villageId: membership.villageId, status: "ACTIVE", role: "RESIDENT" } } },
        { accountKind: AccountKind.RESIDENT_HOUSE, residentHouseAccount: { villageId: membership.villageId, suspendedAt: null } },
      ],
      ...(q ? {
        AND: [{ OR: [
          { name: { contains: q, mode: "insensitive" } },
          { phoneNumber: { contains: q } },
          { residentHouseAccount: { contactPhone: { contains: q } } },
          { residentHouseAccount: { house: { houseNumber: { contains: q, mode: "insensitive" } } } },
        ] }],
      } : {}),
    },
    select: RESIDENT_ACTOR_USER_SELECT,
    take: 25,
    orderBy: { name: "asc" },
  });

  return NextResponse.json(residents.map((resident) => {
    const display = residentActorDisplay(resident, { villageId: membership.villageId });
    return { id: resident.id, name: display.label, phone: display.contactPhone, houseNumber: display.houseNumber ?? "" };
  }));
}
