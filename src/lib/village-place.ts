export const VILLAGE_PLACE_CATEGORIES = [
  "TEMPLE",
  "SHOP",
  "SCHOOL",
  "CLINIC",
  "GOVERNMENT",
  "OTHER",
] as const;

export type VillagePlaceCategoryValue = (typeof VILLAGE_PLACE_CATEGORIES)[number];

export type VillagePlaceInput = {
  name: string;
  category: VillagePlaceCategoryValue;
  description: string;
  address: string;
  openingHours: string;
  contactPhone: string;
  mapUrl: string;
  latitude: number | null;
  longitude: number | null;
  isPublic: boolean;
  imageUrls: string[];
};

export function isVillagePlaceCategory(value: string): value is VillagePlaceCategoryValue {
  return (VILLAGE_PLACE_CATEGORIES as readonly string[]).includes(value);
}

export function normalizeVillagePlaceInput(data: {
  name?: string;
  category?: string;
  description?: string;
  address?: string;
  openingHours?: string;
  contactPhone?: string;
  mapUrl?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  isPublic?: boolean;
  imageUrls?: string[];
}): { ok: true; value: VillagePlaceInput } | { ok: false; error: string } {
  const name = (data.name ?? "").trim();
  if (name.length < 2) {
    return { ok: false, error: "กรุณาระบุชื่อสถานที่อย่างน้อย 2 ตัวอักษร" };
  }

  const category = (data.category ?? "OTHER").trim();
  if (!isVillagePlaceCategory(category)) {
    return { ok: false, error: "หมวดหมู่สถานที่ไม่ถูกต้อง" };
  }

  const mapUrl = (data.mapUrl ?? "").trim();
  if (mapUrl && !/^https?:\/\//i.test(mapUrl)) {
    return { ok: false, error: "ลิงก์แผนที่ต้องขึ้นต้นด้วย http:// หรือ https://" };
  }

  const rawLatitude = typeof data.latitude === "string" ? data.latitude.trim() : data.latitude;
  const rawLongitude = typeof data.longitude === "string" ? data.longitude.trim() : data.longitude;
  const latitude = rawLatitude === "" || rawLatitude == null ? null : Number(rawLatitude);
  const longitude = rawLongitude === "" || rawLongitude == null ? null : Number(rawLongitude);

  if ((latitude == null) !== (longitude == null)) {
    return { ok: false, error: "กรุณาระบุพิกัดละติจูดและลองจิจูดให้ครบทั้งคู่" };
  }

  if (latitude != null && (Number.isNaN(latitude) || latitude < -90 || latitude > 90)) {
    return { ok: false, error: "ละติจูดต้องอยู่ระหว่าง -90 ถึง 90" };
  }

  if (longitude != null && (Number.isNaN(longitude) || longitude < -180 || longitude > 180)) {
    return { ok: false, error: "ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180" };
  }

  const imageUrls = (data.imageUrls ?? [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (
    imageUrls.some(
      (url) => !url.startsWith("data:image/") && !/^https?:\/\//i.test(url)
    )
  ) {
    return { ok: false, error: "รูปภาพต้องเป็นไฟล์ที่อัปโหลดหรือ URL ที่ถูกต้อง" };
  }

  return {
    ok: true,
    value: {
      name,
      category,
      description: (data.description ?? "").trim(),
      address: (data.address ?? "").trim(),
      openingHours: (data.openingHours ?? "").trim(),
      contactPhone: (data.contactPhone ?? "").trim(),
      mapUrl,
      latitude,
      longitude,
      isPublic: Boolean(data.isPublic),
      imageUrls,
    },
  };
}

export function parseVillagePlacePayload(payload: unknown): VillagePlaceInput | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as Record<string, unknown>;

  const result = normalizeVillagePlaceInput({
    name: typeof candidate.name === "string" ? candidate.name : "",
    category: typeof candidate.category === "string" ? candidate.category : "OTHER",
    description: typeof candidate.description === "string" ? candidate.description : "",
    address: typeof candidate.address === "string" ? candidate.address : "",
    openingHours: typeof candidate.openingHours === "string" ? candidate.openingHours : "",
    contactPhone: typeof candidate.contactPhone === "string" ? candidate.contactPhone : "",
    mapUrl: typeof candidate.mapUrl === "string" ? candidate.mapUrl : "",
    latitude: typeof candidate.latitude === "number" || typeof candidate.latitude === "string" ? candidate.latitude : null,
    longitude: typeof candidate.longitude === "number" || typeof candidate.longitude === "string" ? candidate.longitude : null,
    isPublic: Boolean(candidate.isPublic),
    imageUrls: Array.isArray(candidate.imageUrls)
      ? candidate.imageUrls.map((value) => String(value))
      : [],
  });

  return result.ok ? result.value : null;
}

export function getVillagePlaceEmbedMapUrl(latitude: number | null, longitude: number | null): string | null {
  if (latitude == null || longitude == null) return null;
  return `https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`;
}
