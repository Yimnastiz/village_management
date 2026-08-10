"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { findBuiltInVillageCatalogItem } from "@/data/thailand-village-catalog";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminActionSession, writeSuperAdminAuditLog } from "@/lib/superadmin";
import { normalizeThaiAreaName, normalizeThaiVillageName, validateThaiLocation } from "@/lib/thai-geography";
import { buildCatalogVillageSlug, normalizeVillageSlugInput } from "@/lib/village-slug";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(formData: FormData, key: string): string | null {
  return readString(formData, key) || null;
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

function mooNumber(value: string | null) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : Number.MAX_SAFE_INTEGER;
}

function mooKey(value: string | null) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? String(numericValue) : value?.trim() ?? "";
}

function catalogAvailabilityRank(item: { village: { isActive: boolean } | null }) {
  return item.village ? 1 : 0;
}

function areaCandidates(value: string, prefixes: string[]) {
  return Array.from(new Set([value, ...prefixes.flatMap((prefix) => [`${prefix}${value}`, `${prefix} ${value}`])]));
}

async function readVillagePayload(formData: FormData) {
  const mode: "catalog" | "manual" = readString(formData, "mode") === "manual" ? "manual" : "catalog";
  const catalogSource = readString(formData, "catalogSource") === "BUILT_IN_DEMO" ? "BUILT_IN_DEMO" : "DATABASE";
  const catalogVillageId = optionalString(formData, "catalogVillageId");
  const builtInCatalogId = optionalString(formData, "builtInCatalogId");
  const sourceNote = optionalString(formData, "sourceNote");
  const typedName = readString(formData, "name");
  let canonical: { name: string; moo: string | null; province: string; district: string; subdistrict: string; catalogVillageId: string | null; officialCode: string | null; fallbackId?: string | null };
  let resolvedBuiltInCatalogId: string | null = null;
  if (mode === "catalog") {
    const currentVillageId = optionalString(formData, "id");
    if (catalogSource === "BUILT_IN_DEMO") {
      if (!builtInCatalogId) throw new Error("กรุณาเลือกหมู่บ้านจากข้อมูลตัวอย่างในโปรเจกต์");
      const catalog = findBuiltInVillageCatalogItem(builtInCatalogId);
      if (!catalog) throw new Error("ไม่พบหมู่บ้านตัวอย่างในโปรเจกต์");
      resolvedBuiltInCatalogId = catalog.officialCode;
      const duplicate = await prisma.village.findFirst({ where: { name: catalog.villageName, moo: catalog.moo ?? null, province: normalizeThaiAreaName(catalog.province), district: normalizeThaiAreaName(catalog.district), subdistrict: normalizeThaiAreaName(catalog.subdistrict) }, select: { id: true } });
      if (duplicate && duplicate.id !== currentVillageId) throw new Error("หมู่บ้านตัวอย่างนี้ถูกเปิดใช้งานแล้ว");
      canonical = { name: catalog.villageName, moo: catalog.moo ?? null, province: normalizeThaiAreaName(catalog.province), district: normalizeThaiAreaName(catalog.district), subdistrict: normalizeThaiAreaName(catalog.subdistrict), catalogVillageId: null, officialCode: catalog.officialCode, fallbackId: catalog.officialCode };
    } else {
      if (!catalogVillageId) throw new Error("กรุณาเลือกหมู่บ้านจากฐานข้อมูลอ้างอิง");
      const catalog = await prisma.thailandVillageMaster.findUnique({ where: { id: catalogVillageId } });
      if (!catalog) throw new Error("ไม่พบหมู่บ้านในฐานข้อมูลอ้างอิง");
      const linkedVillage = await prisma.village.findFirst({ where: { catalogVillageId }, select: { id: true } });
      if (linkedVillage && linkedVillage.id !== currentVillageId) throw new Error("หมู่บ้านจากฐานข้อมูลอ้างอิงนี้ถูกเปิดใช้งานแล้ว");
      canonical = { name: catalog.villageName, moo: catalog.moo, province: normalizeThaiAreaName(catalog.province), district: normalizeThaiAreaName(catalog.district), subdistrict: normalizeThaiAreaName(catalog.subdistrict), catalogVillageId: catalog.id, officialCode: catalog.officialCode, fallbackId: catalog.id };
    }
  } else {
    if (!typedName) throw new Error("กรุณากรอกชื่อหมู่บ้าน");
    if (!sourceNote) throw new Error("กรุณาระบุเหตุผลหรือที่มาสำหรับการเพิ่มแบบ Manual");
    if (!optionalString(formData, "moo")) throw new Error("กรุณาระบุหมู่ที่สำหรับการเพิ่มแบบ Manual");
    const location = validateThaiLocation({ province: readString(formData, "province"), district: readString(formData, "district"), subdistrict: readString(formData, "subdistrict") });
    if (!location.ok) throw new Error(location.error);
    canonical = { name: typedName, moo: optionalString(formData, "moo"), province: location.province, district: location.district, subdistrict: location.subdistrict, catalogVillageId: null, officialCode: null };
  }

  const slug = mode === "catalog"
    // Never trust the form value for catalog villages. Their official identity owns the slug.
    ? buildCatalogVillageSlug({ villageName: canonical.name, moo: canonical.moo, officialCode: canonical.officialCode, fallbackId: canonical.fallbackId })
    : normalizeVillageSlugInput(readString(formData, "slug") || typedName);
  if (!slug) throw new Error("กรุณากรอก slug ที่ถูกต้อง");

  return {
    name: canonical.name,
    moo: canonical.moo,
    slug,
    description: optionalString(formData, "description"),
    province: canonical.province,
    district: canonical.district,
    subdistrict: canonical.subdistrict,
    address: optionalString(formData, "address"),
    phone: optionalString(formData, "phone"),
    email: optionalString(formData, "email"),
    website: optionalString(formData, "website"),
    catalogVillageId: canonical.catalogVillageId,
    sourceNote: mode === "catalog" && catalogSource === "BUILT_IN_DEMO" ? "Created from built-in demo village catalog" : sourceNote,
    catalogSource,
    builtInCatalogId: resolvedBuiltInCatalogId,
    mode,
  };
}

async function assertVillageIsNotDuplicated(data: { catalogVillageId: string | null; slug: string; province: string; district: string; subdistrict: string; moo: string | null }, mode: "catalog" | "manual", currentVillageId?: string) {
  const excludeCurrent = currentVillageId ? { id: { not: currentVillageId } } : {};
  const duplicateArea = await prisma.village.findFirst({
    where: { ...excludeCurrent, province: data.province, district: data.district, subdistrict: data.subdistrict, moo: data.moo },
    select: { id: true },
  });
  if (duplicateArea) throw new Error("มีหมู่บ้านในจังหวัด อำเภอ ตำบล และหมู่นี้อยู่แล้ว ไม่สามารถเพิ่มซ้ำได้");

  const duplicateSlug = await prisma.village.findFirst({ where: { ...excludeCurrent, slug: data.slug }, select: { id: true } });
  if (duplicateSlug) throw new Error(mode === "catalog" ? "หมู่บ้านนี้ถูกเปิดใช้งานแล้ว หรือ slug ของหมู่บ้านซ้ำกับข้อมูลเดิม" : "Slug นี้ถูกใช้แล้ว กรุณาใช้ slug อื่น");

  if (data.catalogVillageId) {
    const duplicateCatalog = await prisma.village.findFirst({ where: { ...excludeCurrent, catalogVillageId: data.catalogVillageId }, select: { id: true } });
    if (duplicateCatalog) throw new Error("หมู่บ้านนี้ถูกเปิดใช้งานแล้ว ไม่สามารถเปิดซ้ำได้");
  }
}

export async function createVillageAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();
  const payload = await readVillagePayload(formData);
  const { mode, catalogSource, builtInCatalogId, ...data } = payload;
  await assertVillageIsNotDuplicated(data, mode);
  let created;
  try {
    created = await prisma.village.create({ data: { ...data, isActive: true } });
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new Error(mode === "catalog" ? "หมู่บ้านจากฐานข้อมูลอ้างอิงนี้ถูกเปิดใช้งานแล้ว หรือ slug จากรหัสหมู่บ้านซ้ำกับข้อมูลเดิม" : "Slug นี้ถูกใช้แล้ว กรุณาใช้ slug อื่น");
    throw error;
  }
  await writeSuperAdminAuditLog({ userId: session.id, action: mode === "catalog" ? AuditAction.VILLAGE_CREATED_FROM_CATALOG : AuditAction.VILLAGE_CREATED_MANUAL, resource: "Village", resourceId: created.id, villageId: created.id, metadata: { name: created.name, slug: created.slug, sourceNote: created.sourceNote, catalogVillageId: created.catalogVillageId, catalogSource, builtInCatalogId } });
  revalidatePath("/superadmin/villages");
  revalidatePath("/superadmin/dashboard");
}

export async function updateVillageAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();
  const id = readString(formData, "id");
  if (!id) throw new Error("ไม่พบรหัสหมู่บ้าน");
  const payload = await readVillagePayload(formData);
  const { mode, catalogSource, builtInCatalogId, ...data } = payload;
  // Keep published legacy URLs stable. New catalog activations always receive
  // the officialCode-based slug; an existing catalog village is not renamed
  // merely because somebody edits its metadata.
  const existingVillage = await prisma.village.findUnique({ where: { id }, select: { slug: true, catalogVillageId: true } });
  if (!existingVillage) throw new Error("ไม่พบหมู่บ้าน");
  await assertVillageIsNotDuplicated(data, existingVillage.catalogVillageId ? "catalog" : mode, id);
  let updated;
  try {
    updated = await prisma.village.update({ where: { id }, data: { ...data, slug: existingVillage.catalogVillageId || mode === "catalog" ? existingVillage.slug : data.slug } });
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new Error(mode === "catalog" ? "หมู่บ้านจากฐานข้อมูลอ้างอิงนี้ถูกเปิดใช้งานแล้ว หรือ slug จากรหัสหมู่บ้านซ้ำกับข้อมูลเดิม" : "Slug นี้ถูกใช้แล้ว กรุณาใช้ slug อื่น");
    throw error;
  }
  await writeSuperAdminAuditLog({ userId: session.id, action: AuditAction.UPDATE, resource: "Village", resourceId: id, villageId: id, metadata: { name: updated.name, slug: updated.slug, mode, sourceNote: updated.sourceNote, catalogVillageId: updated.catalogVillageId, catalogSource, builtInCatalogId } });
  revalidatePath("/superadmin/villages");
  revalidatePath("/superadmin/dashboard");
}

export async function searchVillageCatalogAction(input: { province: string; district: string; subdistrict: string; query?: string }) {
  await requireSuperAdminActionSession();
  const province = normalizeThaiAreaName(input.province);
  const district = normalizeThaiAreaName(input.district);
  const subdistrict = normalizeThaiAreaName(input.subdistrict);
  const query = (input.query ?? "").trim();
  if (!province || !district || !subdistrict) return { items: [], totalCount: 0, source: "DATABASE" as const, note: "" };
  const areaWhere = { province: { in: areaCandidates(province, ["จังหวัด", "จ."]) }, district: { in: areaCandidates(district, ["อำเภอ", "อ."]) }, subdistrict: { in: areaCandidates(subdistrict, ["ตำบล", "ต."]) } };
  const villageKeyword = normalizeThaiVillageName(query);
  const mooKeyword = query.replace(/^(หมู่\s*|ม\.?\s*)/u, "").trim();
  const keywordWhere = query ? {
    OR: [
      { villageName: { contains: query, mode: "insensitive" as const } },
      { villageName: { contains: villageKeyword, mode: "insensitive" as const } },
      { officialCode: { contains: query, mode: "insensitive" as const } },
      { moo: { contains: query, mode: "insensitive" as const } },
      ...( /^\d+$/u.test(mooKeyword) ? [{ moo: { equals: String(Number(mooKeyword)) } }] : []),
    ],
  } : {};
  const where = { ...areaWhere, ...keywordWhere };
  const databaseTotal = await prisma.thailandVillageMaster.count();
  if (databaseTotal === 0) {
    return { items: [], totalCount: 0, source: "DATABASE" as const, note: "Catalog ยังไม่ถูก import: วาง JSON ดิบใน data/raw/gdcatalog-villages/ แล้วรัน npm run catalog:setup" };
  }
  const [items, totalCount, existingVillages] = await Promise.all([
    prisma.thailandVillageMaster.findMany({ where, select: { id: true, officialCode: true, villageName: true, moo: true, province: true, district: true, subdistrict: true, sourceName: true, village: { select: { id: true, isActive: true } } }, orderBy: [{ villageName: "asc" }, { moo: "asc" }], take: 100 }),
    prisma.thailandVillageMaster.count({ where: areaWhere }),
    prisma.village.findMany({
      where: {
        province: { in: areaCandidates(province, ["จังหวัด", "จ."]) },
        district: { in: areaCandidates(district, ["อำเภอ", "อ."]) },
        subdistrict: { in: areaCandidates(subdistrict, ["ตำบล", "ต."]) },
      },
      select: { id: true, moo: true, isActive: true },
    }),
  ]);
  const villageByMoo = new Map(existingVillages.map((village) => [mooKey(village.moo), village]));
  const itemsWithAreaActivation = items.map((item) => {
    const existingVillage = item.village ?? villageByMoo.get(mooKey(item.moo)) ?? null;
    // Any existing record, including a Manual one, makes this real-world moo unavailable.
    return { ...item, village: existingVillage ? { id: existingVillage.id, isActive: true } : null };
  });
  const sortedItems = [...itemsWithAreaActivation].sort((left, right) => {
    const availabilityCompare = catalogAvailabilityRank(left) - catalogAvailabilityRank(right);
    if (availabilityCompare !== 0) return availabilityCompare;
    const nameCompare = left.villageName.localeCompare(right.villageName, "th");
    if (nameCompare !== 0) return nameCompare;
    return mooNumber(left.moo) - mooNumber(right.moo);
  });
  return { items: sortedItems.map((item) => ({ ...item, source: "DATABASE" as const })), totalCount, source: "DATABASE" as const, note: totalCount === 0 ? "พื้นที่นี้ไม่มีข้อมูลใน Catalog" : "พบข้อมูลจากฐานข้อมูลอ้างอิง" };
}

export async function toggleVillageActiveAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();
  const id = readString(formData, "id");
  const nextActive = readString(formData, "nextActive") === "true";
  if (!id) throw new Error("ไม่พบรหัสหมู่บ้าน");
  const updated = await prisma.village.update({ where: { id }, data: { isActive: nextActive }, select: { id: true, name: true, isActive: true } });
  await writeSuperAdminAuditLog({ userId: session.id, action: AuditAction.UPDATE, resource: "VillageStatus", resourceId: id, villageId: id, metadata: { name: updated.name, isActive: updated.isActive } });
  revalidatePath("/superadmin/villages");
  revalidatePath("/superadmin/dashboard");
}

export async function deleteVillageAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();
  const id = readString(formData, "id");
  if (!id) throw new Error("ไม่พบรหัสหมู่บ้าน");
  const usage = await prisma.village.findUnique({ where: { id }, select: { name: true, _count: { select: { houses: true, memberships: true, news: true, issues: true, appointments: true } } } });
  if (!usage) throw new Error("ไม่พบหมู่บ้าน");
  if (usage._count.houses > 0 || usage._count.memberships > 0 || usage._count.news > 0 || usage._count.issues > 0 || usage._count.appointments > 0) throw new Error("ลบหมู่บ้านนี้ไม่ได้เพราะมีข้อมูลใช้งานอยู่ ให้ปิดการใช้งานแทน");
  await prisma.village.delete({ where: { id } });
  await writeSuperAdminAuditLog({ userId: session.id, action: AuditAction.DELETE, resource: "Village", resourceId: id, villageId: id, metadata: { name: usage.name } });
  revalidatePath("/superadmin/villages");
  revalidatePath("/superadmin/dashboard");
}
