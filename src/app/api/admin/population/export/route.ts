import { NextResponse } from "next/server";
import { utils, write } from "xlsx";
import { getSessionContextFromRequest, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getSessionContextFromRequest(request);
  if (!session || !isAdminUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) {
    return NextResponse.json({ error: "Village not found" }, { status: 404 });
  }

  const [village, houses, people, memberships] = await Promise.all([
    prisma.village.findUnique({
      where: { id: membership.villageId },
      select: { name: true },
    }),
    prisma.house.findMany({
      where: { villageId: membership.villageId },
      orderBy: [{ houseNumber: "asc" }],
      include: { zone: { select: { name: true } }, _count: { select: { persons: true } } },
    }),
    prisma.person.findMany({
      where: { villageId: membership.villageId },
      orderBy: [{ house: { houseNumber: "asc" } }, { firstName: "asc" }, { lastName: "asc" }],
      include: { house: { select: { houseNumber: true, address: true } } },
    }),
    prisma.villageMembership.findMany({
      where: { villageId: membership.villageId },
      orderBy: [{ joinedAt: "desc" }],
      include: { user: { select: { name: true, phoneNumber: true, email: true, citizenVerifiedAt: true } }, house: { select: { houseNumber: true } } },
    }),
  ]);

  const summarySheet = utils.json_to_sheet([
    {
      village_name: village?.name ?? "Unknown",
      exported_at: new Date().toISOString(),
      total_houses: houses.length,
      total_people: people.length,
      total_memberships: memberships.length,
    },
  ]);

  const houseSheet = utils.json_to_sheet(
    houses.map((house) => ({
      house_number: house.houseNumber,
      house_address: house.address ?? "",
      zone_name: house.zone?.name ?? "",
      occupancy_status: house.occupancyStatus,
      latitude: house.latitude ?? "",
      longitude: house.longitude ?? "",
      resident_count: house._count.persons,
      created_at: house.createdAt.toISOString(),
      updated_at: house.updatedAt.toISOString(),
    })),
  );

  const peopleSheet = utils.json_to_sheet(
    people.map((person) => ({
      house_number: person.house?.houseNumber ?? "",
      first_name: person.firstName,
      last_name: person.lastName,
      national_id: person.nationalId ?? "",
      date_of_birth: person.dateOfBirth ? person.dateOfBirth.toISOString().slice(0, 10) : "",
      gender: person.gender ?? "",
      phone_number: person.phone ?? "",
      email: person.email ?? "",
      person_status: person.status,
      house_address: person.house?.address ?? "",
      created_at: person.createdAt.toISOString(),
      updated_at: person.updatedAt.toISOString(),
    })),
  );

  const membershipSheet = utils.json_to_sheet(
    memberships.map((item) => ({
      user_name: item.user.name,
      phone_number: item.user.phoneNumber,
      email: item.user.email ?? "",
      house_number: item.house?.houseNumber ?? "",
      membership_role: item.role,
      membership_status: item.status,
      citizen_verified_at: item.user.citizenVerifiedAt?.toISOString() ?? "",
      joined_at: item.joinedAt?.toISOString() ?? "",
      created_at: item.createdAt.toISOString(),
    })),
  );

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, summarySheet, "summary");
  utils.book_append_sheet(workbook, houseSheet, "houses");
  utils.book_append_sheet(workbook, peopleSheet, "people");
  utils.book_append_sheet(workbook, membershipSheet, "accounts");

  const fileBuffer = write(workbook, { type: "buffer", bookType: "xlsx" });
  const fileName = `population-export-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}