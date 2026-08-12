"use server";

import {
  HouseholdOccupancyStatus,
  AuditAction,
  MembershipStatus,
  PersonStatus,
  MovementType,
  PopulationImportStage,
  Prisma,
  RegistrationTempStatus,
  VillageMembershipRole,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { SSF, read, utils } from "xlsx";
import { getSessionContextFromServerCookies, isAdminUser, isSuperAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { isValidHouseNumber, normalizeHouseNumber } from "@/lib/house-number";
import { maskNationalId } from "@/lib/utils";
import {
  POPULATION_IMPORT_COLUMNS,
  POPULATION_IMPORT_HEADER_ALIASES,
} from "@/features/population/server/import-template";

const ADMIN_MEMBERSHIP_ROLES = new Set<VillageMembershipRole>([
  VillageMembershipRole.HEADMAN,
  VillageMembershipRole.ASSISTANT_HEADMAN,
  VillageMembershipRole.COMMITTEE,
]);

const MAX_IMPORT_ERRORS = 50;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_IMPORT_ROWS = 10_000;
const MAX_IMPORT_COLUMNS = 40;

function requestedActorRole(formData: FormData) {
  return typeof formData.get("targetVillageId") === "string" && String(formData.get("targetVillageId")).trim()
    ? "SUPERADMIN"
    : "ADMIN";
}

type CanonicalColumnKey =
  | "house_number"
  | "first_name"
  | "last_name"
  | "external_person_id"
  | "phone_number"
  | "national_id"
  | "date_of_birth"
  | "gender"
  | "email"
  | "house_address"
  | "zone_name"
  | "occupancy_status"
  | "person_status"
  | "movement_type"
  | "movement_date"
  | "latitude"
  | "longitude"
  | "create_user_account"
  | "is_citizen_verified"
  | "note";

export type ImportActionState = {
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

type ImportJobDetailsPayload = {
  errors: string[];
  sourceHeaders: string[];
  previewColumns: string[];
  previewRows: Array<Record<string, string>>;
  importedPersonIds: string[];
  importedHouseIds: string[];
  importedUserIds: string[];
  rowDetails?: ImportRowDetail[];
};

export type ImportRowDetail = {
  rowNumber: number;
  action: "CREATE" | "UPDATE" | "SKIP" | "CONFLICT" | "FAILED";
  status: "VALID" | "INVALID" | "CONFLICT" | "PENDING";
  createdRecordId?: string | null;
  matchedRecordId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  changedFields?: string[];
  confidenceLevel?: "HIGH_CONFIDENCE_MATCH" | "POSSIBLE_MATCH" | "CONFLICT" | "NEW_RECORD" | "INVALID";
};

export type StoredImportRow = NormalizedImportRow & {
  rowNumber: number;
  matchedPersonId: string | null;
  action: "CREATE" | "UPDATE" | "SKIP" | "CONFLICT" | "FAILED";
};

type RowImportResult = {
  resolvedUserId: string | null;
  resolvedPersonId: string | null;
  resolvedHouseId: string;
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
  firstName: string | null;
  lastName: string | null;
  externalPersonId: string | null;
  phoneNumber: string | null;
  nationalId: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  email: string | null;
  houseAddress: string | null;
  zoneName: string | null;
  occupancyStatus: HouseholdOccupancyStatus | null;
  personStatus: PersonStatus | null;
  movementType: MovementType | null;
  movementDate: Date | null;
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

function parseMovementType(value: unknown): MovementType | null {
  const normalized = toTrimmedString(value)?.toUpperCase().replace(/[ -]+/g, "_");
  if (!normalized) return null;
  if (!Object.values(MovementType).includes(normalized as MovementType)) throw new Error(`ประเภทการย้ายไม่ถูกต้อง: ${value}`);
  return normalized as MovementType;
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

  const missingHeaders = ["house_number"].filter(
    (header) => !presentHeaders.has(header as CanonicalColumnKey),
  );

  if (missingHeaders.length > 0) {
    throw new Error(`ไม่พบหัวคอลัมน์ที่จำเป็น: ${missingHeaders.join(", ")}`);
  }
}

function parseImportRow(row: Partial<Record<CanonicalColumnKey, unknown>>): NormalizedImportRow {
  const rawHouseNumber = toTrimmedString(row.house_number);
  const houseNumber = normalizeHouseNumber(rawHouseNumber ?? "");
  const firstName = toTrimmedString(row.first_name);
  const lastName = toTrimmedString(row.last_name);

  if (!rawHouseNumber || !isValidHouseNumber(houseNumber)) {
    throw new Error("ต้องมี house_number ที่ถูกต้อง");
  }
  if (Boolean(firstName) !== Boolean(lastName)) {
    throw new Error("หากนำเข้าบุคคล ต้องระบุทั้ง first_name และ last_name");
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
    externalPersonId: toTrimmedString(row.external_person_id),
    phoneNumber,
    nationalId,
    dateOfBirth,
    gender: toTrimmedString(row.gender),
    email,
    houseAddress: toTrimmedString(row.house_address),
    zoneName: toTrimmedString(row.zone_name),
    occupancyStatus: parseHouseholdOccupancyStatus(row.occupancy_status),
    personStatus: parsePersonStatus(row.person_status),
    movementType: parseMovementType(row.movement_type),
    movementDate: parseSpreadsheetDate(row.movement_date),
    latitude: parseNumericValue(row.latitude, "latitude"),
    longitude: parseNumericValue(row.longitude, "longitude"),
    createUserAccount,
    isCitizenVerified,
    note: toTrimmedString(row.note),
  };
}

function scoreDecodedText(value: string) {
  const thaiChars = (value.match(/[\u0E00-\u0E7F]/g) ?? []).length;
  const replacementChars = (value.match(/�/g) ?? []).length;
  const mojibakeFragments = (value.match(/à¸|à¹|Ã|Â/g) ?? []).length;

  return thaiChars * 2 - replacementChars * 4 - mojibakeFragments * 3;
}

function decodeCsvText(buffer: Buffer) {
  const utf8Text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  const cp874Text = new TextDecoder("windows-874", { fatal: false }).decode(buffer);

  return scoreDecodedText(cp874Text) > scoreDecodedText(utf8Text) ? cp874Text : utf8Text;
}

function extractRowsFromWorkbook(buffer: Buffer, fileName: string) {
  const isCsv = /\.csv$/i.test(fileName);
  const workbook = isCsv
    ? read(decodeCsvText(buffer), { type: "string", cellDates: true })
    : read(buffer, { type: "buffer", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("ไม่พบ worksheet ในไฟล์ที่อัปโหลด");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = utils.sheet_to_json<SpreadsheetRow>(sheet, {
    defval: "",
    raw: true,
  });

  ensureRequiredHeaders(rawRows);

  const sourceHeaders = rawRows[0] ? Object.keys(rawRows[0]) : [];
  if (rawRows.length > MAX_IMPORT_ROWS) {
    throw new Error(`ไฟล์มีข้อมูลเกิน ${MAX_IMPORT_ROWS.toLocaleString()} แถว`);
  }
  if (sourceHeaders.length > MAX_IMPORT_COLUMNS) {
    throw new Error(`ไฟล์มีคอลัมน์เกิน ${MAX_IMPORT_COLUMNS} คอลัมน์`);
  }
  const rows = rawRows.map(canonicalizeSpreadsheetRow);

  return {
    rows,
    sourceHeaders,
  };
}

function buildImportJobDetailsPayload(params: {
  rows: Array<Partial<Record<CanonicalColumnKey, unknown>>>;
  sourceHeaders: string[];
  errors: string[];
  importedPersonIds?: string[];
  importedHouseIds?: string[];
  importedUserIds?: string[];
  rowDetails?: ImportRowDetail[];
}): ImportJobDetailsPayload {
  const {
    rows,
    sourceHeaders,
    errors,
    importedPersonIds = [],
    importedHouseIds = [],
    importedUserIds = [],
    rowDetails = [],
  } = params;

  const previewColumns = POPULATION_IMPORT_COLUMNS
    .map((column) => column.key)
    .filter((key) => rows.some((row) => toTrimmedString(row[key as CanonicalColumnKey]) !== null));

  const effectiveColumns =
    previewColumns.length > 0 ? previewColumns : POPULATION_IMPORT_COLUMNS.map((column) => column.key).slice(0, 8);

  const previewRows = rows.slice(0, 20).map((row) => {
    const normalizedRow: Record<string, string> = {};
    for (const column of effectiveColumns) {
      const value = row[column as CanonicalColumnKey];
      const text = toTrimmedString(value) ?? "";
      normalizedRow[column] = column === "national_id" ? maskNationalId(text) : column === "phone_number" && text.length > 4 ? `${"*".repeat(Math.max(0, text.length - 4))}${text.slice(-4)}` : text;
    }
    return normalizedRow;
  });

  return {
    errors,
    sourceHeaders,
    previewColumns: effectiveColumns,
    previewRows,
    importedPersonIds,
    importedHouseIds,
    importedUserIds,
    rowDetails,
  };
}

async function getAdminVillageContext(formData?: FormData): Promise<AdminVillageContext> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id || (!isAdminUser(session) && !isSuperAdminUser(session))) {
    throw new Error("ไม่มีสิทธิ์ใช้งานหน้านี้");
  }

  const requestedVillageId = typeof formData?.get("targetVillageId") === "string" ? String(formData.get("targetVillageId")).trim() : "";
  const adminMembership = session.memberships.find(
    (membership) =>
      membership.status === MembershipStatus.ACTIVE &&
      ADMIN_MEMBERSHIP_ROLES.has(membership.role),
  );

  const targetVillageId = isSuperAdminUser(session) ? requestedVillageId : adminMembership?.villageId;
  if (!targetVillageId) {
    throw new Error("ไม่พบหมู่บ้านที่คุณมีสิทธิ์จัดการ");
  }

  const village = await prisma.village.findUnique({
    where: { id: targetVillageId },
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
): Promise<RowImportResult> {
  const zoneId = await resolveZoneId(tx, ctx.villageId, row.zoneName);

  const house = await tx.house.upsert({
    where: {
      villageId_normalizedHouseNumber: {
        villageId: ctx.villageId,
        normalizedHouseNumber: row.houseNumber,
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
      normalizedHouseNumber: row.houseNumber,
      address: row.houseAddress,
      occupancyStatus: row.occupancyStatus ?? HouseholdOccupancyStatus.OCCUPIED,
      zoneId,
      latitude: row.latitude,
      longitude: row.longitude,
      sourceType: "IMPORT",
      sourceNote: row.note ?? "Imported from admin population import",
      verifiedAt: new Date(),
    },
    select: { id: true },
  });

  let resolvedUserId: string | null = null;
  if (row.phoneNumber && row.firstName && row.lastName) {
    const existingUser = await tx.user.findUnique({
      where: { phoneNumber: row.phoneNumber },
      select: { id: true },
    });

    if (existingUser || row.createUserAccount) {
      const fullName = `${row.firstName} ${row.lastName}`;
      const user = existingUser
        ? await tx.user.update({
            where: { phoneNumber: row.phoneNumber },
            data: {
              name: fullName,
              ...(row.email ? { email: row.email } : {}),
              registrationProvince: ctx.province,
              registrationDistrict: ctx.district,
              registrationSubdistrict: ctx.subdistrict,
              registrationVillageId: ctx.villageId,
            },
            select: { id: true },
          })
        : await tx.user.create({
            data: {
              phoneNumber: row.phoneNumber,
              name: fullName,
              email: row.email,
              registrationProvince: ctx.province,
              registrationDistrict: ctx.district,
              registrationSubdistrict: ctx.subdistrict,
              registrationVillageId: ctx.villageId,
              citizenVerifiedAt: null,
              consentAt: null,
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
          status: MembershipStatus.PENDING,
          houseId: house.id,
          joinedAt: null,
        },
        create: {
          userId: user.id,
          villageId: ctx.villageId,
          role: VillageMembershipRole.RESIDENT,
          status: MembershipStatus.PENDING,
          houseId: house.id,
          joinedAt: null,
        },
      });

      await tx.phoneRoleSeed.upsert({
        where: { phoneNumber: row.phoneNumber },
        update: {
          villageId: ctx.villageId,
          membershipRole: VillageMembershipRole.RESIDENT,
          systemRole: null,
          isCitizenVerified: false,
          note:
            row.note ?? `Imported from admin population import / house ${row.houseNumber}`,
        },
        create: {
          phoneNumber: row.phoneNumber,
          villageId: ctx.villageId,
          membershipRole: VillageMembershipRole.RESIDENT,
          isCitizenVerified: false,
          note:
            row.note ?? `Imported from admin population import / house ${row.houseNumber}`,
        },
      });
    }
  }

  if (!row.firstName || !row.lastName) {
    return { resolvedUserId, resolvedPersonId: null, resolvedHouseId: house.id };
  }

  if (!resolvedUserId && row.phoneNumber) {
    const phoneUser = await tx.user.findUnique({ where: { phoneNumber: row.phoneNumber }, select: { id: true } });
    resolvedUserId = phoneUser?.id ?? null;
  }
  if (!resolvedUserId && row.nationalId) {
    const verifiedRegistration = await tx.registrationTemp.findFirst({
      where: { nationalId: row.nationalId, villageId: ctx.villageId, status: RegistrationTempStatus.VERIFIED },
      orderBy: { updatedAt: "desc" },
      select: { phoneNumber: true },
    });
    if (verifiedRegistration) {
      const registrationUser = await tx.user.findUnique({ where: { phoneNumber: verifiedRegistration.phoneNumber }, select: { id: true } });
      resolvedUserId = registrationUser?.id ?? null;
    }
  }

  const personSearchConditions: Prisma.PersonWhereInput[] = [];
  if (row.nationalId) {
    personSearchConditions.push({ nationalId: row.nationalId, villageId: ctx.villageId });
  }
  if (row.phoneNumber) {
    personSearchConditions.push({ phone: row.phoneNumber, villageId: ctx.villageId });
  }

  const existingPerson = personSearchConditions.length
    ? await tx.person.findFirst({
        where: {
          OR: personSearchConditions,
        },
        select: { id: true, userId: true },
        orderBy: { updatedAt: "desc" },
      })
    : null;

  const canLinkUser = Boolean(resolvedUserId && (!existingPerson?.userId || existingPerson.userId === resolvedUserId));
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
    ...(canLinkUser ? { userId: resolvedUserId } : {}),
  };

  let resolvedPersonId: string;
  if (existingPerson) {
    const updatedPerson = await tx.person.update({
      where: { id: existingPerson.id },
      data: personData,
      select: { id: true },
    });
    resolvedPersonId = updatedPerson.id;
  } else {
    const createdPerson = await tx.person.create({
      data: personData,
      select: { id: true },
    });
    resolvedPersonId = createdPerson.id;
  }

  if (row.movementType && resolvedPersonId) {
    await tx.personMovement.create({ data: { personId: resolvedPersonId, houseId: house.id, movementType: row.movementType, date: row.movementDate ?? new Date() } });
  } else if (resolvedPersonId && !existingPerson) {
    await tx.personMovement.create({ data: { personId: resolvedPersonId, houseId: house.id, movementType: MovementType.MOVE_IN, date: row.movementDate ?? new Date() } });
  }

  return {
    resolvedUserId,
    resolvedPersonId,
    resolvedHouseId: house.id,
  };
}

function formatError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientValidationError) {
    return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
  }
  if (error instanceof Error) {
    return /prisma|P\d{4}|unique constraint|invocation/i.test(error.message) ? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" : error.message;
  }

  return "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
}

export async function applyStoredImportRow(
  tx: Prisma.TransactionClient,
  ctx: AdminVillageContext,
  row: StoredImportRow,
) {
  const zone = row.zoneName ? await tx.villageZone.findFirst({ where: { villageId: ctx.villageId, name: row.zoneName }, select: { id: true } }) : null;
  const existingHouse = await tx.house.findUnique({ where: { villageId_normalizedHouseNumber: { villageId: ctx.villageId, normalizedHouseNumber: row.houseNumber } }, select: { id: true } });
  const house = existingHouse
    ? await tx.house.update({ where: { id: existingHouse.id }, data: { ...(row.houseAddress ? { address: row.houseAddress } : {}), ...(row.occupancyStatus ? { occupancyStatus: row.occupancyStatus } : {}), ...(zone ? { zoneId: zone.id } : {}), ...(row.latitude !== null ? { latitude: row.latitude } : {}), ...(row.longitude !== null ? { longitude: row.longitude } : {}) }, select: { id: true } })
    : await tx.house.create({ data: { villageId: ctx.villageId, houseNumber: row.houseNumber, normalizedHouseNumber: row.houseNumber, address: row.houseAddress, occupancyStatus: row.occupancyStatus ?? HouseholdOccupancyStatus.OCCUPIED, zoneId: zone?.id ?? null, latitude: row.latitude, longitude: row.longitude, sourceType: "IMPORT", sourceNote: row.note ?? "Population import confirmed by administrator", verifiedByUserId: ctx.userId, verifiedAt: new Date() }, select: { id: true } });

  const dateOfBirth = row.dateOfBirth ? new Date(row.dateOfBirth) : null;
  if (!row.firstName || !row.lastName) return { personId: null, houseId: house.id };
  const personData = { villageId: ctx.villageId, houseId: house.id, nationalId: row.nationalId, firstName: row.firstName, lastName: row.lastName, dateOfBirth, gender: row.gender, phone: row.phoneNumber, email: row.email, status: row.personStatus ?? PersonStatus.ACTIVE };
  const person = row.matchedPersonId
    ? await tx.person.update({ where: { id: row.matchedPersonId }, data: personData, select: { id: true } })
    : await tx.person.create({ data: personData, select: { id: true } });
  if (person.id && (row.movementType || !row.matchedPersonId)) await tx.personMovement.create({ data: { personId: person.id, houseId: house.id, movementType: row.movementType ?? MovementType.MOVE_IN, date: row.movementDate ?? new Date() } });
  return { personId: person.id, houseId: house.id };
}

async function validateRowsForPreview(
  ctx: AdminVillageContext,
  rows: Array<Partial<Record<CanonicalColumnKey, unknown>>>,
) {
  const details: ImportRowDetail[] = [];
  const storedRows: StoredImportRow[] = [];
  const seenKeys = new Set<string>();
  let createdRows = 0;
  let updatedRows = 0;
  let conflictRows = 0;
  let failedRows = 0;

  for (const [index, rawRow] of rows.entries()) {
    const rowNumber = index + 2;
    try {
      const parsed = parseImportRow(rawRow);
      const duplicateKey = parsed.firstName && parsed.lastName
        ? parsed.nationalId ? `nid:${parsed.nationalId}` : parsed.phoneNumber ? `phone:${parsed.phoneNumber}` : `person:${parsed.firstName.toLowerCase()}|${parsed.lastName.toLowerCase()}|${parsed.dateOfBirth?.toISOString() ?? ""}|${parsed.houseNumber}`
        : `house:${parsed.houseNumber}`;
      if (seenKeys.has(duplicateKey)) {
        conflictRows += 1;
        details.push({ rowNumber, action: "CONFLICT", status: "CONFLICT", errorCode: "DUPLICATE_IN_FILE", errorMessage: "พบข้อมูลบุคคลซ้ำภายในไฟล์เดียวกัน", confidenceLevel: "CONFLICT" });
        storedRows.push({ ...parsed, rowNumber, matchedPersonId: null, action: "CONFLICT" });
        continue;
      }
      seenKeys.add(duplicateKey);

      const [byNationalId, byPhone, byIdentity, existingHouse] = await Promise.all([
        parsed.nationalId ? prisma.person.findFirst({ where: { villageId: ctx.villageId, nationalId: parsed.nationalId }, select: { id: true, phone: true } }) : null,
        parsed.phoneNumber ? prisma.person.findFirst({ where: { villageId: ctx.villageId, phone: parsed.phoneNumber }, select: { id: true, nationalId: true } }) : null,
        parsed.firstName && parsed.lastName ? prisma.person.findFirst({ where: { villageId: ctx.villageId, firstName: parsed.firstName, lastName: parsed.lastName, dateOfBirth: parsed.dateOfBirth, house: { normalizedHouseNumber: parsed.houseNumber } }, select: { id: true } }) : null,
        prisma.house.findUnique({ where: { villageId_normalizedHouseNumber: { villageId: ctx.villageId, normalizedHouseNumber: parsed.houseNumber } }, select: { id: true } }),
      ]);
      if (!parsed.firstName || !parsed.lastName) {
        const action = existingHouse ? "UPDATE" : "CREATE";
        if (action === "CREATE") createdRows += 1; else updatedRows += 1;
        details.push({ rowNumber, action, status: "VALID", matchedRecordId: existingHouse?.id ?? null, changedFields: existingHouse ? ["house"] : ["NEW_HOUSE_REQUIRES_CONFIRM"], confidenceLevel: existingHouse ? "HIGH_CONFIDENCE_MATCH" : "NEW_RECORD" });
        storedRows.push({ ...parsed, rowNumber, matchedPersonId: null, action });
        continue;
      }
      if (byNationalId && byPhone && byNationalId.id !== byPhone.id) {
        conflictRows += 1;
        details.push({ rowNumber, action: "CONFLICT", status: "CONFLICT", errorCode: "IDENTIFIER_CONFLICT", errorMessage: "national_id และ phone_number อ้างถึงคนละบุคคล", confidenceLevel: "CONFLICT" });
        storedRows.push({ ...parsed, rowNumber, matchedPersonId: null, action: "CONFLICT" });
        continue;
      }
      if (byNationalId && byPhone && byNationalId.id !== byPhone.id) {
        conflictRows += 1;
        details.push({ rowNumber, action: "CONFLICT", status: "CONFLICT", errorCode: "IDENTITY_MATCH_CONFLICT", errorMessage: "เลขบัตรประชาชนและเบอร์โทรศัพท์ชี้ไปยังบุคคลคนละรายการ", confidenceLevel: "CONFLICT" });
        storedRows.push({ ...parsed, rowNumber, matchedPersonId: null, action: "CONFLICT" });
        continue;
      }
      const matched = byNationalId ?? byPhone ?? byIdentity;
      const confidenceLevel = byNationalId && byPhone ? "HIGH_CONFIDENCE_MATCH" : matched ? (byNationalId || byPhone ? "HIGH_CONFIDENCE_MATCH" : "POSSIBLE_MATCH") : "NEW_RECORD";
      const action = matched ? "UPDATE" : "CREATE";
      if (matched) updatedRows += 1; else createdRows += 1;
      details.push({ rowNumber, action, status: "VALID", matchedRecordId: matched?.id ?? null, changedFields: ["person", ...(existingHouse ? ["existing_house"] : ["NEW_HOUSE_REQUIRES_CONFIRM"])], confidenceLevel });
      storedRows.push({ ...parsed, rowNumber, matchedPersonId: matched?.id ?? null, action });
    } catch (error) {
      failedRows += 1;
      details.push({ rowNumber, action: "FAILED", status: "INVALID", errorCode: "INVALID_ROW", errorMessage: formatError(error), confidenceLevel: "INVALID" });
        storedRows.push({ houseNumber: "", firstName: null, lastName: null, externalPersonId: null, phoneNumber: null, nationalId: null, dateOfBirth: null, gender: null, email: null, houseAddress: null, zoneName: null, occupancyStatus: null, personStatus: null, movementType: null, movementDate: null, latitude: null, longitude: null, createUserAccount: false, isCitizenVerified: false, note: null, rowNumber, matchedPersonId: null, action: "FAILED" });
    }
  }
  return { details, storedRows, createdRows, updatedRows, conflictRows, failedRows };
}

export async function importPopulationWorkbookAction(
  _prevState: ImportActionState | null,
  formData: FormData,
): Promise<ImportActionState> {
  let jobId: string | null = null;

  try {
    const ctx = await getAdminVillageContext(formData);
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

    const allowedMimeTypes = new Set([
      "text/csv",
      "application/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/octet-stream",
    ]);
    if (fileEntry.type && !allowedMimeTypes.has(fileEntry.type.toLowerCase())) {
      return { success: false, message: "MIME type ของไฟล์ไม่ตรงกับ CSV/XLS/XLSX" };
    }

    const job = await prisma.populationImportJob.create({
      data: {
        villageId: ctx.villageId,
        createdBy: ctx.userId,
        fileName: fileEntry.name,
        stage: PopulationImportStage.PENDING,
        startedAt: new Date(),
      },
      select: { id: true },
    });
    jobId = job.id;
    await prisma.auditLog.create({ data: { userId: ctx.userId, villageId: ctx.villageId, action: AuditAction.POPULATION_IMPORT_STARTED, resource: "PopulationImportJob", resourceId: jobId, metadata: { actorRole: requestedActorRole(formData), jobId, fileName: fileEntry.name } } });

    const buffer = Buffer.from(await fileEntry.arrayBuffer());
    const isCsv = /\.csv$/i.test(fileEntry.name);
    const hasZipSignature = buffer[0] === 0x50 && buffer[1] === 0x4b;
    const hasOleSignature = buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    if ((!isCsv && /\.xlsx$/i.test(fileEntry.name) && !hasZipSignature) || (!isCsv && /\.xls$/i.test(fileEntry.name) && !hasOleSignature)) {
      await prisma.populationImportJob.update({
        where: { id: jobId },
        data: { stage: PopulationImportStage.FAILED, completedAt: new Date() },
      });
      return { success: false, message: "ลายเซ็นไฟล์ไม่ตรงกับนามสกุลที่อัปโหลด" };
    }
    const { rows: spreadsheetRows, sourceHeaders } = extractRowsFromWorkbook(buffer, fileEntry.name);

    if (spreadsheetRows.length === 0) {
      await prisma.populationImportJob.update({
        where: { id: jobId },
        data: {
          stage: PopulationImportStage.FAILED,
          totalRows: 0,
          importedRows: 0,
          failedRows: 0,
          completedAt: new Date(),
          errors: buildImportJobDetailsPayload({
            rows: [],
            sourceHeaders,
            errors: ["ไม่พบข้อมูลใน worksheet แรก"],
          }),
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

    const preview = await validateRowsForPreview(ctx, spreadsheetRows);
    const previewErrors = preview.details.filter((detail) => detail.errorMessage).slice(0, MAX_IMPORT_ERRORS).map((detail) => `แถว ${detail.rowNumber}: ${detail.errorMessage}`);
    await prisma.populationImportJob.update({
      where: { id: jobId },
      data: {
        stage: PopulationImportStage.PENDING,
        importedRows: 0,
        failedRows: preview.failedRows + preview.conflictRows,
        createdRows: preview.createdRows,
        updatedRows: preview.updatedRows,
        conflictRows: preview.conflictRows,
        sourceRows: JSON.parse(JSON.stringify(preview.storedRows)) as Prisma.InputJsonValue,
        errors: buildImportJobDetailsPayload({ rows: spreadsheetRows, sourceHeaders, errors: previewErrors, rowDetails: preview.details }),
      },
    });
    await prisma.auditLog.create({ data: { userId: ctx.userId, villageId: ctx.villageId, action: AuditAction.POPULATION_IMPORT_VALIDATED, resource: "PopulationImportJob", resourceId: jobId, metadata: { actorRole: requestedActorRole(formData), jobId, fileName: fileEntry.name, totalRows: spreadsheetRows.length, createdRows: preview.createdRows, updatedRows: preview.updatedRows, conflictRows: preview.conflictRows, failedRows: preview.failedRows } } });
    revalidatePath("/admin/population/import");
    return { success: true, message: `ตรวจสอบไฟล์แล้ว กรุณาเปิดงาน ${jobId} เพื่อดู Preview และยืนยัน`, summary: { fileName: fileEntry.name, totalRows: spreadsheetRows.length, importedRows: 0, failedRows: preview.failedRows + preview.conflictRows, stage: PopulationImportStage.PENDING }, errors: previewErrors };

    let importedRows = 0;
    let failedRows = 0;
    const errors: string[] = [];
    const importedPersonIds = new Set<string>();
    const importedHouseIds = new Set<string>();
    const importedUserIds = new Set<string>();

    for (const [index, rawRow] of spreadsheetRows.entries()) {
      const rowNumber = index + 2;

      try {
        const parsedRow = parseImportRow(rawRow);
        const rowResult = await prisma.$transaction(async (tx) => {
          return importRowIntoVillage(tx, ctx, parsedRow);
        });

        const resolvedPersonId = rowResult.resolvedPersonId;
        if (resolvedPersonId !== null) importedPersonIds.add(resolvedPersonId as string);
        importedHouseIds.add(rowResult.resolvedHouseId);
        const resolvedUserId = rowResult.resolvedUserId;
        if (resolvedUserId !== null) importedUserIds.add(resolvedUserId as string);

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
      where: { id: jobId! },
      data: {
        stage,
        importedRows,
        failedRows,
        completedAt: new Date(),
        errors: buildImportJobDetailsPayload({
          rows: spreadsheetRows,
          sourceHeaders,
          errors,
          importedPersonIds: Array.from(importedPersonIds),
          importedHouseIds: Array.from(importedHouseIds),
          importedUserIds: Array.from(importedUserIds),
        }),
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
        fileName: String((fileEntry as File | null)?.name ?? "import"),
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
          errors: {
            errors: [message],
            sourceHeaders: [],
            previewColumns: [],
            previewRows: [],
            importedPersonIds: [],
            importedHouseIds: [],
            importedUserIds: [],
          },
        },
      });
    }

    return {
      success: false,
      message,
    };
  }
}

