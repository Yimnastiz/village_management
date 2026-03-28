"use server";

import {
  HouseholdOccupancyStatus,
  MembershipStatus,
  PersonStatus,
  PopulationImportStage,
  Prisma,
  VillageMembershipRole,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { SSF, read, utils } from "xlsx";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { POPULATION_IMPORT_HEADER_ALIASES } from "./import-template";

const ADMIN_MEMBERSHIP_ROLES = new Set<VillageMembershipRole>([
  VillageMembershipRole.HEADMAN,
  VillageMembershipRole.ASSISTANT_HEADMAN,
  VillageMembershipRole.COMMITTEE,
]);

const MAX_IMPORT_ERRORS = 50;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type CanonicalColumnKey =
  | "house_number"
  | "first_name"
  | "last_name"
  | "phone_number"
  | "national_id"
  | "date_of_birth"
  | "gender"
  | "email"
  | "house_address"
  | "zone_name"
  | "occupancy_status"
  | "person_status"
  | "latitude"
  | "longitude"
  | "create_user_account"
  | "is_citizen_verified"
  | "note";

type ImportActionState = {
  success: boolean;
  message: string;
  summary?: {
    fileName: string;
    totalRows: number;
    importedRows: number;
    failedRows: number;
    stage: PopulationImportStage;
  };
  errors?: string[];
};

type AdminVillageContext = {
  userId: string;
  villageId: string;
  villageName: string;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
};

type SpreadsheetRow = Record<string, unknown>;

type NormalizedImportRow = {
  houseNumber: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  nationalId: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  email: string | null;
  houseAddress: string | null;
  zoneName: string | null;
  occupancyStatus: HouseholdOccupancyStatus | null;
  personStatus: PersonStatus | null;
  latitude: number | null;
  longitude: number | null;
  createUserAccount: boolean;
  isCitizenVerified: boolean;
  note: string | null;
};

const HEADER_ALIAS_LOOKUP = Object.entries(POPULATION_IMPORT_HEADER_ALIASES).reduce<Record<string, CanonicalColumnKey>>(
  (lookup, [canonicalKey, aliases]) => {
    for (const alias of aliases) {
      lookup[normalizeHeaderKey(alias)] = canonicalKey as CanonicalColumnKey;
    }
    return lookup;
  },
  {},
);

function normalizeHeaderKey(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./()]+/g, "")
    .replace(/[:;]/g, "");
}

function toTrimmedString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }

    return Number.isInteger(value) ? String(value) : String(value);
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value).trim() || null;
}

function normalizePhoneNumber(raw: string): string {
  return raw.replace(/[\s()-]/g, "");
}

function parseBooleanValue(value: unknown): boolean | null {
  const normalized = toTrimmedString(value)?.toLowerCase();
  if (!normalized) {
    return null;
  }

  if (["true", "1", "yes", "y", "ใช่", "จริง"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "n", "ไม่", "ไม่ใช่", "เท็จ"].includes(normalized)) {
    return false;
  }

  throw new Error(`ค่า boolean ไม่ถูกต้อง: ${normalized}`);
}

function parseNumericValue(value: unknown, fieldName: string): number | null {
  const normalized = toTrimmedString(value);
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} ต้องเป็นตัวเลข`);
  }

  return parsed;
}

function parseSpreadsheetDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const parsed = SSF.parse_date_code(value);
    if (!parsed) {
      return null;
    }

    return new Date(parsed.y, parsed.m - 1, parsed.d);
  }

  const text = toTrimmedString(value);
  if (!text) {
    return null;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseHouseholdOccupancyStatus(value: unknown): HouseholdOccupancyStatus | null {
  const normalized = toTrimmedString(value)?.toUpperCase();
  if (!normalized) {
    return null;
  }

  const mapped: Record<string, HouseholdOccupancyStatus> = {
    OCCUPIED: HouseholdOccupancyStatus.OCCUPIED,
    VACANT: HouseholdOccupancyStatus.VACANT,
    UNDERCONSTRUCTION: HouseholdOccupancyStatus.UNDER_CONSTRUCTION,
    UNDER_CONSTRUCTION: HouseholdOccupancyStatus.UNDER_CONSTRUCTION,
    DEMOLISHED: HouseholdOccupancyStatus.DEMOLISHED,
    อยู่จริง: HouseholdOccupancyStatus.OCCUPIED,
    ว่าง: HouseholdOccupancyStatus.VACANT,
    ก่อสร้าง: HouseholdOccupancyStatus.UNDER_CONSTRUCTION,
    รื้อถอน: HouseholdOccupancyStatus.DEMOLISHED,
  };

  const matched = mapped[normalized] ?? mapped[toTrimmedString(value) ?? ""];
  if (!matched) {
    throw new Error(`สถานะบ้านไม่ถูกต้อง: ${value}`);
  }

  return matched;
}

function parsePersonStatus(value: unknown): PersonStatus | null {
  const normalized = toTrimmedString(value)?.toUpperCase();
  if (!normalized) {
    return null;
  }

  const mapped: Record<string, PersonStatus> = {
    ACTIVE: PersonStatus.ACTIVE,
    DECEASED: PersonStatus.DECEASED,
    MOVEDOUT: PersonStatus.MOVED_OUT,
    MOVED_OUT: PersonStatus.MOVED_OUT,
    UNKNOWN: PersonStatus.UNKNOWN,
    ปกติ: PersonStatus.ACTIVE,
    เสียชีวิต: PersonStatus.DECEASED,
    ย้ายออก: PersonStatus.MOVED_OUT,
    ไม่ทราบ: PersonStatus.UNKNOWN,
  };

  const matched = mapped[normalized] ?? mapped[toTrimmedString(value) ?? ""];
  if (!matched) {
    throw new Error(`สถานะบุคคลไม่ถูกต้อง: ${value}`);
  }

  return matched;
}

function canonicalizeSpreadsheetRow(row: SpreadsheetRow) {
  const normalized: Partial<Record<CanonicalColumnKey, unknown>> = {};

  for (const [rawKey, rawValue] of Object.entries(row)) {
    const canonicalKey = HEADER_ALIAS_LOOKUP[normalizeHeaderKey(rawKey)];
    if (canonicalKey && normalized[canonicalKey] === undefined) {
      normalized[canonicalKey] = rawValue;
    }
  }

  return normalized;
}

function ensureRequiredHeaders(rows: SpreadsheetRow[]) {
  const firstRow = rows[0];
  if (!firstRow) {
    throw new Error("ไม่พบข้อมูลในไฟล์ หรือไม่มีแถวข้อมูลหลังหัวตาราง");
  }

  const presentHeaders = new Set(
    Object.keys(firstRow)
      .map((key) => HEADER_ALIAS_LOOKUP[normalizeHeaderKey(key)])
      .filter(Boolean),
  );

  const missingHeaders = ["house_number", "first_name", "last_name"].filter(
    (header) => !presentHeaders.has(header as CanonicalColumnKey),
  );

  if (missingHeaders.length > 0) {
    throw new Error(`ไม่พบหัวคอลัมน์ที่จำเป็น: ${missingHeaders.join(", ")}`);
  }
}

function parseImportRow(row: Partial<Record<CanonicalColumnKey, unknown>>): NormalizedImportRow {
  const houseNumber = toTrimmedString(row.house_number);
  const firstName = toTrimmedString(row.first_name);
  const lastName = toTrimmedString(row.last_name);

  if (!houseNumber || !firstName || !lastName) {
    throw new Error("ต้องมี house_number, first_name และ last_name");
  }

  const phoneNumberRaw = toTrimmedString(row.phone_number);
  const phoneNumber = phoneNumberRaw ? normalizePhoneNumber(phoneNumberRaw) : null;
  if (phoneNumber && !/^\+?\d{9,15}$/.test(phoneNumber)) {
    throw new Error("เบอร์โทรศัพท์ไม่ถูกต้อง");
  }

  const nationalId = toTrimmedString(row.national_id);
  if (nationalId && !/^\d{13}$/.test(nationalId)) {
    throw new Error("เลขบัตรประชาชนต้องมี 13 หลัก");
  }

  const dateOfBirth = parseSpreadsheetDate(row.date_of_birth);
  if (row.date_of_birth && !dateOfBirth) {
    throw new Error("วันเกิดไม่ถูกต้อง");
  }

  const email = toTrimmedString(row.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("อีเมลไม่ถูกต้อง");
  }

  const createUserAccount = parseBooleanValue(row.create_user_account) ?? false;
  const isCitizenVerified = parseBooleanValue(row.is_citizen_verified) ?? false;

  if (createUserAccount && !phoneNumber) {
    throw new Error("ถ้าจะสร้างบัญชีผู้ใช้ ต้องระบุ phone_number");
  }

  return {
    houseNumber,
    firstName,
    lastName,
    phoneNumber,
    nationalId,
    dateOfBirth,
    gender: toTrimmedString(row.gender),
    email,
    houseAddress: toTrimmedString(row.house_address),
    zoneName: toTrimmedString(row.zone_name),
    occupancyStatus: parseHouseholdOccupancyStatus(row.occupancy_status),
    personStatus: parsePersonStatus(row.person_status),
    latitude: parseNumericValue(row.latitude, "latitude"),
    longitude: parseNumericValue(row.longitude, "longitude"),
    createUserAccount,
    isCitizenVerified,
    note: toTrimmedString(row.note),
  };
}

function extractRowsFromWorkbook(buffer: Buffer) {
  const workbook = read(buffer, { type: "buffer", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("ไม่พบ worksheet ในไฟล์ที่อัปโหลด");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = utils.sheet_to_json<SpreadsheetRow>(sheet, {
    defval: "",
    raw: true,
  });

  ensureRequiredHeaders(rows);
  return rows.map(canonicalizeSpreadsheetRow);
}

async function getAdminVillageContext(): Promise<AdminVillageContext> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id || !isAdminUser(session)) {
    throw new Error("ไม่มีสิทธิ์ใช้งานหน้านี้");
  }

  const adminMembership = session.memberships.find(
    (membership) =>
      membership.status === MembershipStatus.ACTIVE &&
      ADMIN_MEMBERSHIP_ROLES.has(membership.role),
  );

  if (!adminMembership) {
    throw new Error("ไม่พบหมู่บ้านที่คุณมีสิทธิ์จัดการ");
  }

  const village = await prisma.village.findUnique({
    where: { id: adminMembership.villageId },
    select: {
      id: true,
      name: true,
      province: true,
      district: true,
      subdistrict: true,
    },
  });

  if (!village) {
    throw new Error("ไม่พบข้อมูลหมู่บ้าน");
  }

  return {
    userId: session.id,
    villageId: village.id,
    villageName: village.name,
    province: village.province,
    district: village.district,
    subdistrict: village.subdistrict,
  };
}

async function resolveZoneId(
  tx: Prisma.TransactionClient,
  villageId: string,
  zoneName: string | null,
) {
  if (!zoneName) {
    return null;
  }

  const existing = await tx.villageZone.findFirst({
    where: { villageId, name: zoneName },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const created = await tx.villageZone.create({
    data: {
      villageId,
      name: zoneName,
    },
    select: { id: true },
  });

  return created.id;
}

async function importRowIntoVillage(
  tx: Prisma.TransactionClient,
  ctx: AdminVillageContext,
  row: NormalizedImportRow,
) {
  const zoneId = await resolveZoneId(tx, ctx.villageId, row.zoneName);

  const house = await tx.house.upsert({
    where: {
      villageId_houseNumber: {
        villageId: ctx.villageId,
        houseNumber: row.houseNumber,
      },
    },
    update: {
      ...(row.houseAddress ? { address: row.houseAddress } : {}),
      ...(row.occupancyStatus ? { occupancyStatus: row.occupancyStatus } : {}),
      ...(zoneId ? { zoneId } : {}),
      ...(row.latitude !== null ? { latitude: row.latitude } : {}),
      ...(row.longitude !== null ? { longitude: row.longitude } : {}),
    },
    create: {
      villageId: ctx.villageId,
      houseNumber: row.houseNumber,
      address: row.houseAddress,
      occupancyStatus: row.occupancyStatus ?? HouseholdOccupancyStatus.OCCUPIED,
      zoneId,
      latitude: row.latitude,
      longitude: row.longitude,
    },
    select: { id: true },
  });

  let resolvedUserId: string | null = null;
  if (row.phoneNumber) {
    const existingUser = await tx.user.findUnique({
      where: { phoneNumber: row.phoneNumber },
      select: { id: true },
    });

    if (existingUser || row.createUserAccount) {
      const fullName = `${row.firstName} ${row.lastName}`;
      const verifiedAt = row.isCitizenVerified ? new Date() : undefined;

      const user = existingUser
        ? await tx.user.update({
            where: { phoneNumber: row.phoneNumber },
            data: {
              name: fullName,
              ...(row.email ? { email: row.email } : {}),
              phoneNumberVerified: true,
              registrationProvince: ctx.province,
              registrationDistrict: ctx.district,
              registrationSubdistrict: ctx.subdistrict,
              registrationVillageId: ctx.villageId,
              ...(verifiedAt
                ? {
                    citizenVerifiedAt: verifiedAt,
                    consentAt: verifiedAt,
                  }
                : {}),
            },
            select: { id: true },
          })
        : await tx.user.create({
            data: {
              phoneNumber: row.phoneNumber,
              phoneNumberVerified: true,
              name: fullName,
              email: row.email,
              registrationProvince: ctx.province,
              registrationDistrict: ctx.district,
              registrationSubdistrict: ctx.subdistrict,
              registrationVillageId: ctx.villageId,
              citizenVerifiedAt: verifiedAt ?? null,
              consentAt: verifiedAt ?? null,
            },
            select: { id: true },
          });

      resolvedUserId = user.id;

      await tx.villageMembership.upsert({
        where: {
          userId_villageId: {
            userId: user.id,
            villageId: ctx.villageId,
          },
        },
        update: {
          role: VillageMembershipRole.RESIDENT,
          status: MembershipStatus.ACTIVE,
          houseId: house.id,
          joinedAt: new Date(),
        },
        create: {
          userId: user.id,
          villageId: ctx.villageId,
          role: VillageMembershipRole.RESIDENT,
          status: MembershipStatus.ACTIVE,
          houseId: house.id,
          joinedAt: new Date(),
        },
      });

      await tx.phoneRoleSeed.upsert({
        where: { phoneNumber: row.phoneNumber },
        update: {
          villageId: ctx.villageId,
          membershipRole: VillageMembershipRole.RESIDENT,
          systemRole: null,
          isCitizenVerified: row.isCitizenVerified,
          note:
            row.note ?? `Imported from admin population import / house ${row.houseNumber}`,
        },
        create: {
          phoneNumber: row.phoneNumber,
          villageId: ctx.villageId,
          membershipRole: VillageMembershipRole.RESIDENT,
          isCitizenVerified: row.isCitizenVerified,
          note:
            row.note ?? `Imported from admin population import / house ${row.houseNumber}`,
        },
      });
    }
  }

  const personSearchConditions: Prisma.PersonWhereInput[] = [];
  if (row.nationalId) {
    personSearchConditions.push({ nationalId: row.nationalId });
  }
  if (row.phoneNumber) {
    personSearchConditions.push({ phone: row.phoneNumber, villageId: ctx.villageId });
  }

  const existingPerson = personSearchConditions.length
    ? await tx.person.findFirst({
        where: {
          OR: personSearchConditions,
        },
        select: { id: true },
        orderBy: { updatedAt: "desc" },
      })
    : null;

  const personData = {
    villageId: ctx.villageId,
    houseId: house.id,
    nationalId: row.nationalId,
    firstName: row.firstName,
    lastName: row.lastName,
    dateOfBirth: row.dateOfBirth,
    gender: row.gender,
    phone: row.phoneNumber,
    email: row.email,
    status: row.personStatus ?? PersonStatus.ACTIVE,
  };

  if (existingPerson) {
    await tx.person.update({
      where: { id: existingPerson.id },
      data: personData,
    });
  } else {
    await tx.person.create({
      data: personData,
    });
  }

  return { resolvedUserId };
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
}

export async function importPopulationWorkbookAction(
  _prevState: ImportActionState | null,
  formData: FormData,
): Promise<ImportActionState> {
  let jobId: string | null = null;

  try {
    const ctx = await getAdminVillageContext();
    const fileEntry = formData.get("importFile");

    if (!(fileEntry instanceof File) || fileEntry.size === 0) {
      return { success: false, message: "กรุณาเลือกไฟล์ .xlsx, .xls หรือ .csv ก่อนนำเข้า" };
    }

    if (fileEntry.size > MAX_UPLOAD_BYTES) {
      return { success: false, message: "ไฟล์มีขนาดใหญ่เกิน 10MB" };
    }

    if (!/\.(xlsx|xls|csv)$/i.test(fileEntry.name)) {
      return { success: false, message: "รองรับเฉพาะไฟล์ .xlsx, .xls และ .csv" };
    }

    const job = await prisma.populationImportJob.create({
      data: {
        villageId: ctx.villageId,
        createdBy: ctx.userId,
        fileName: fileEntry.name,
        stage: PopulationImportStage.PROCESSING,
        startedAt: new Date(),
      },
      select: { id: true },
    });
    jobId = job.id;

    const buffer = Buffer.from(await fileEntry.arrayBuffer());
    const spreadsheetRows = extractRowsFromWorkbook(buffer);

    if (spreadsheetRows.length === 0) {
      await prisma.populationImportJob.update({
        where: { id: jobId },
        data: {
          stage: PopulationImportStage.FAILED,
          totalRows: 0,
          importedRows: 0,
          failedRows: 0,
          completedAt: new Date(),
          errors: ["ไม่พบข้อมูลใน worksheet แรก"],
        },
      });

      return { success: false, message: "ไม่พบข้อมูลใน worksheet แรก" };
    }

    await prisma.populationImportJob.update({
      where: { id: jobId },
      data: {
        totalRows: spreadsheetRows.length,
      },
    });

    let importedRows = 0;
    let failedRows = 0;
    const errors: string[] = [];

    for (const [index, rawRow] of spreadsheetRows.entries()) {
      const rowNumber = index + 2;

      try {
        const parsedRow = parseImportRow(rawRow);
        await prisma.$transaction(async (tx) => {
          await importRowIntoVillage(tx, ctx, parsedRow);
        });
        importedRows += 1;
      } catch (error) {
        failedRows += 1;
        if (errors.length < MAX_IMPORT_ERRORS) {
          errors.push(`แถว ${rowNumber}: ${formatError(error)}`);
        }
      }
    }

    const stage =
      importedRows === 0
        ? PopulationImportStage.FAILED
        : failedRows > 0
          ? PopulationImportStage.PARTIAL
          : PopulationImportStage.COMPLETED;

    await prisma.populationImportJob.update({
      where: { id: jobId },
      data: {
        stage,
        importedRows,
        failedRows,
        completedAt: new Date(),
        errors: errors.length > 0 ? errors : Prisma.JsonNull,
      },
    });

    revalidatePath("/admin/population/import");
    revalidatePath("/admin/population/houses");
    revalidatePath("/admin/population/people");

    return {
      success: stage !== PopulationImportStage.FAILED,
      message:
        stage === PopulationImportStage.COMPLETED
          ? `นำเข้าข้อมูลเข้า ${ctx.villageName} สำเร็จ ${importedRows} แถว`
          : stage === PopulationImportStage.PARTIAL
            ? `นำเข้าบางส่วนสำเร็จ ${importedRows} แถว และล้มเหลว ${failedRows} แถว`
            : "ไม่สามารถนำเข้าข้อมูลได้",
      summary: {
        fileName: fileEntry.name,
        totalRows: spreadsheetRows.length,
        importedRows,
        failedRows,
        stage,
      },
      errors,
    };
  } catch (error) {
    const message = formatError(error);

    if (jobId) {
      await prisma.populationImportJob.update({
        where: { id: jobId },
        data: {
          stage: PopulationImportStage.FAILED,
          completedAt: new Date(),
          errors: [message],
        },
      });
    }

    return {
      success: false,
      message,
    };
  }
}

export type { ImportActionState };