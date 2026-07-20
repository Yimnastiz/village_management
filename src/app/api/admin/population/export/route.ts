import { NextResponse } from "next/server";
import { utils, write } from "xlsx";
import { getAdminMembership, getHeadmanMembership, getSessionContextFromRequest, isAdminUser } from "@/lib/access-control";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { escapeSpreadsheetFormula, maskNationalId } from "@/lib/utils";

export async function GET(request: Request) {
  const session = await getSessionContextFromRequest(request);
  if (!session || !isAdminUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = getAdminMembership(session);
  if (!membership) {
    return NextResponse.json({ error: "Village not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const requestedSheets = (url.searchParams.get("sheets") ?? "houses,people,accounts").split(",").filter((value) => ["houses", "people", "accounts"].includes(value));
  const masked = !(url.searchParams.get("masked") === "false" && Boolean(getHeadmanMembership(session)));
  const activeOnly = url.searchParams.get("activeOnly") === "true";
  const zoneId = url.searchParams.get("zoneId");
  const status = url.searchParams.get("status");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const createdAt = from || to ? { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lt: new Date(`${to}T23:59:59.999Z`) } : {}) } : undefined;
  const [village, houses, people, memberships] = await Promise.all([
    prisma.village.findUnique({
      where: { id: membership.villageId },
      select: { name: true },
    }),
    prisma.house.findMany({
      where: { villageId: membership.villageId, ...(zoneId ? { zoneId } : {}), ...(status ? { occupancyStatus: status as "OCCUPIED" | "VACANT" | "UNDER_CONSTRUCTION" | "DEMOLISHED" } : {}), ...(createdAt ? { createdAt } : {}) },
      orderBy: [{ houseNumber: "asc" }],
      include: { zone: { select: { name: true } }, _count: { select: { persons: true } } },
    }),
    prisma.person.findMany({
      where: { villageId: membership.villageId, ...(activeOnly ? { status: "ACTIVE" } : {}), ...(createdAt ? { createdAt } : {}) },
      orderBy: [{ house: { houseNumber: "asc" } }, { firstName: "asc" }, { lastName: "asc" }],
      include: { house: { select: { houseNumber: true, address: true } } },
    }),
    prisma.villageMembership.findMany({
      where: { villageId: membership.villageId, ...(activeOnly ? { status: "ACTIVE" } : {}), ...(createdAt ? { createdAt } : {}) },
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
      house_number: escapeSpreadsheetFormula(house.houseNumber),
      house_address: escapeSpreadsheetFormula(house.address ?? ""),
      zone_name: escapeSpreadsheetFormula(house.zone?.name ?? ""),
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
      house_number: escapeSpreadsheetFormula(person.house?.houseNumber ?? ""),
      first_name: escapeSpreadsheetFormula(person.firstName),
      last_name: escapeSpreadsheetFormula(person.lastName),
      national_id: person.nationalId ? maskNationalId(person.nationalId) : "",
      date_of_birth: person.dateOfBirth ? person.dateOfBirth.toISOString().slice(0, 10) : "",
      gender: person.gender ?? "",
      phone_number: masked ? maskPhone(person.phone ?? "") : escapeSpreadsheetFormula(person.phone ?? ""),
      email: masked ? "[MASKED]" : escapeSpreadsheetFormula(person.email ?? ""),
      person_status: person.status,
      house_address: person.house?.address ?? "",
      created_at: person.createdAt.toISOString(),
      updated_at: person.updatedAt.toISOString(),
    })),
  );

  const membershipSheet = utils.json_to_sheet(
    memberships.map((item) => ({
      user_name: escapeSpreadsheetFormula(item.user.name),
      phone_number: masked ? maskPhone(item.user.phoneNumber) : escapeSpreadsheetFormula(item.user.phoneNumber),
      email: masked ? "[MASKED]" : escapeSpreadsheetFormula(item.user.email ?? ""),
      house_number: item.house?.houseNumber ?? "",
      membership_role: item.role,
      membership_status: item.status,
      citizen_verified_at: masked ? "[MASKED]" : item.user.citizenVerifiedAt?.toISOString() ?? "",
      joined_at: item.joinedAt?.toISOString() ?? "",
      created_at: item.createdAt.toISOString(),
    })),
  );

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, summarySheet, "summary");
  if (requestedSheets.includes("houses")) utils.book_append_sheet(workbook, houseSheet, "houses");
  if (requestedSheets.includes("people")) utils.book_append_sheet(workbook, peopleSheet, "people");
  if (requestedSheets.includes("accounts")) utils.book_append_sheet(workbook, membershipSheet, "accounts");

  const fileBuffer = write(workbook, { type: "buffer", bookType: "xlsx" });
  const fileName = `population-export-${new Date().toISOString().slice(0, 10)}.xlsx`;

  await prisma.auditLog.create({ data: { userId: session.id, villageId: membership.villageId, action: AuditAction.POPULATION_EXPORT_CREATED, resource: "PopulationExport", metadata: { actorRole: membership.role, villageId: membership.villageId, sheets: requestedSheets, masked, activeOnly, zoneId, status, from, to } } });

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

function maskPhone(value: string) {
  return value.length > 4 ? `${"*".repeat(value.length - 4)}${value.slice(-4)}` : "[MASKED]";
}
