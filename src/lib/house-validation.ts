export const HOUSE_ADDRESS_MAX_LENGTH = 300;
export const HOUSE_LATITUDE_MIN = -90;
export const HOUSE_LATITUDE_MAX = 90;
export const HOUSE_LONGITUDE_MIN = -180;
export const HOUSE_LONGITUDE_MAX = 180;

export function normalizeHouseAddress(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

export function validateHouseAddress(value: string | null): string | null {
  if (value && value.length > HOUSE_ADDRESS_MAX_LENGTH) {
    return `ที่อยู่เพิ่มเติมต้องไม่เกิน ${HOUSE_ADDRESS_MAX_LENGTH} ตัวอักษร`;
  }
  return null;
}

export function parseOptionalHouseCoordinate(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) {
    return null;
  }
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error(`${fieldName} ต้องเป็นตัวเลขที่ถูกต้อง`);
  }

  const parsed = typeof value === "number" ? value : Number(value.trim());
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} ต้องเป็นตัวเลขที่ถูกต้อง`);
  }
  return parsed;
}

export function validateHouseCoordinates(latitude: number | null, longitude: number | null): string | null {
  if ((latitude === null) !== (longitude === null)) {
    return "กรุณาระบุละติจูดและลองจิจูดให้ครบทั้งสองค่า";
  }
  if (latitude !== null && (!Number.isFinite(latitude) || latitude < HOUSE_LATITUDE_MIN || latitude > HOUSE_LATITUDE_MAX)) {
    return `ละติจูดต้องอยู่ระหว่าง ${HOUSE_LATITUDE_MIN} ถึง ${HOUSE_LATITUDE_MAX}`;
  }
  if (longitude !== null && (!Number.isFinite(longitude) || longitude < HOUSE_LONGITUDE_MIN || longitude > HOUSE_LONGITUDE_MAX)) {
    return `ลองจิจูดต้องอยู่ระหว่าง ${HOUSE_LONGITUDE_MIN} ถึง ${HOUSE_LONGITUDE_MAX}`;
  }
  return null;
}
