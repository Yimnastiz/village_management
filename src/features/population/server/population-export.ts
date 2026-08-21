import { utils, write } from "xlsx";
import { prisma } from "@/lib/prisma";
import { escapeSpreadsheetFormula, maskNationalId } from "@/lib/utils";

export type PopulationExportOptions = {
  sheets: string[];
  masked: boolean;
  activeOnly: boolean;
  zoneId: string | null;
  status: string | null;
  from: string | null;
  to: string | null;
};

const maskPhone = (value: string) => value.length > 4 ? `${"*".repeat(value.length - 4)}${value.slice(-4)}` : "[MASKED]";
const safeText = (value: string) => escapeSpreadsheetFormula(value);

export async function buildVillagePopulationWorkbook(villageId: string, options: PopulationExportOptions) {
  const createdAt = options.from || options.to
    ? { ...(options.from ? { gte: new Date(options.from) } : {}), ...(options.to ? { lt: new Date(`${options.to}T23:59:59.999Z`) } : {}) }
    : undefined;
  const [village, houses, people, memberships] = await Promise.all([
    prisma.village.findUnique({ where: { id: villageId }, select: { name: true } }),
    prisma.house.findMany({
      where: { villageId, ...(options.zoneId ? { zoneId: options.zoneId } : {}), ...(createdAt ? { createdAt } : {}) },
      orderBy: { houseNumber: "asc" },
      include: { zone: { select: { name: true } }, _count: { select: { persons: true } } },
    }),
    prisma.person.findMany({
      where: { villageId, ...(options.activeOnly ? { status: "ACTIVE" as const } : {}), ...(createdAt ? { createdAt } : {}) },
      orderBy: [{ house: { houseNumber: "asc" } }, { firstName: "asc" }],
      include: { house: { select: { houseNumber: true, address: true, villageId: true } } },
    }),
    prisma.villageMembership.findMany({
      where: { villageId, ...(options.activeOnly ? { status: "ACTIVE" as const } : {}), ...(createdAt ? { createdAt } : {}) },
      include: { user: { select: { name: true, phoneNumber: true, email: true, citizenVerifiedAt: true } }, house: { select: { houseNumber: true, villageId: true } } },
    }),
  ]);

  if (!village) throw new Error("Village not found");

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, utils.json_to_sheet([{
    village_name: village.name,
    exported_at: new Date().toISOString(),
    total_houses: houses.length,
    total_people: people.length,
    total_memberships: memberships.length,
  }]), "summary");

  if (options.sheets.includes("houses")) {
    utils.book_append_sheet(workbook, utils.json_to_sheet(houses.map((house) => ({
      house_number: safeText(house.houseNumber),
      house_address: safeText(house.address ?? ""),
      zone_name: safeText(house.zone?.name ?? ""),
      latitude: house.latitude ?? "",
      longitude: house.longitude ?? "",
      resident_count: house._count.persons,
      created_at: house.createdAt.toISOString(),
      updated_at: house.updatedAt.toISOString(),
    }))), "houses");
  }

  if (options.sheets.includes("people")) {
    utils.book_append_sheet(workbook, utils.json_to_sheet(people.map((person) => ({
      house_number: person.house?.villageId === villageId ? safeText(person.house.houseNumber) : "",
      first_name: safeText(person.firstName),
      last_name: safeText(person.lastName),
      national_id: person.nationalId ? (options.masked ? maskNationalId(person.nationalId) : safeText(person.nationalId)) : "",
      date_of_birth: person.dateOfBirth?.toISOString().slice(0, 10) ?? "",
      gender: person.gender ?? "",
      phone_number: options.masked ? maskPhone(person.phone ?? "") : safeText(person.phone ?? ""),
      email: options.masked ? "[MASKED]" : safeText(person.email ?? ""),
      person_status: person.status,
      house_address: safeText(person.house?.address ?? ""),
      created_at: person.createdAt.toISOString(),
      updated_at: person.updatedAt.toISOString(),
    }))), "people");
  }

  if (options.sheets.includes("accounts")) {
    utils.book_append_sheet(workbook, utils.json_to_sheet(memberships.map((membership) => ({
      user_name: safeText(membership.user.name),
      phone_number: options.masked ? maskPhone(membership.user.phoneNumber) : safeText(membership.user.phoneNumber),
      email: options.masked ? "[MASKED]" : safeText(membership.user.email ?? ""),
      house_number: membership.house?.villageId === villageId ? safeText(membership.house.houseNumber) : "",
      membership_role: membership.role,
      membership_status: membership.status,
      citizen_verified_at: options.masked ? "[MASKED]" : membership.user.citizenVerifiedAt?.toISOString() ?? "",
      joined_at: membership.joinedAt?.toISOString() ?? "",
      created_at: membership.createdAt.toISOString(),
    }))), "accounts");
  }

  return { buffer: write(workbook, { type: "buffer", bookType: "xlsx" }), villageName: village.name, counts: { houses: houses.length, people: people.length, memberships: memberships.length } };
}

export function parsePopulationExportOptions(url: URL, forceMasked = false, defaultMasked = true): PopulationExportOptions {
  const requestedMasked = url.searchParams.get("masked");
  return {
    sheets: (url.searchParams.get("sheets") ?? "houses,people,accounts").split(",").filter((value) => ["houses", "people", "accounts"].includes(value)),
    masked: forceMasked || (requestedMasked === null ? defaultMasked : requestedMasked !== "false"),
    activeOnly: url.searchParams.get("activeOnly") === "true",
    zoneId: url.searchParams.get("zoneId"),
    status: url.searchParams.get("status"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  };
}
