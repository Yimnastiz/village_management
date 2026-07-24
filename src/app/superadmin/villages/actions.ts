"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminActionSession, writeSuperAdminAuditLog } from "@/lib/superadmin";
import { normalizeThaiAreaName, normalizeThaiVillageName, validateThaiLocation } from "@/lib/thai-geography";
import { normalizeVillageSlugInput } from "@/lib/village-slug";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(formData: FormData, key: string): string | null {
  const value = readString(formData, key);
  return value || null;
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

function areaCandidates(value: string, prefix: string) {
  return Array.from(new Set([value, `${prefix}${value}`, `${prefix} ${value}`]));
}

async function readVillagePayload(formData: FormData) {
  const mode = readString(formData, "mode") === "manual" ? "manual" : "catalog";
  const catalogVillageId = optionalString(formData, "catalogVillageId");
  const sourceNote = optionalString(formData, "sourceNote");
  const typedName = readString(formData, "name");
  const slug = normalizeVillageSlugInput(readString(formData, "slug") || typedName);
  if (!typedName && mode === "manual") throw new Error("กรุณากรอกชื่อหมู่บ้าน");
  if (!slug) throw new Error("กรุณากรอก slug ที่ถูกต้อง");

  let canonical: { name: string; moo: string | null; province: string; district: string; subdistrict: string; catalogVillageId: string | null };
  if (mode === "catalog") {
    if (!catalogVillageId) throw new Error("กรุณาเลือกหมู่บ้านจากฐานข้อมูลอ้างอิง");
    const catalog = await prisma.thailandVillageMaster.findUnique({ where: { id: catalogVillageId } });
    if (!catalog) throw new Error("ไม่พบหมู่บ้านในฐานข้อมูลอ้างอิง");
    const linkedVillage = await prisma.village.findFirst({ where: { catalogVillageId }, select: { id: true } });
    const currentVillageId = optionalString(formData, "id");
    if (linkedVillage && linkedVillage.id !== currentVillageId) throw new Error("หมู่บ้านจากฐานข้อมูลอ้างอิงนี้ถูกเปิดใช้งานแล้ว");
    canonical = { name: catalog.villageName, moo: catalog.moo, province: normalizeThaiAreaName(catalog.province), district: normalizeThaiAreaName(catalog.district), subdistrict: normalizeThaiAreaName(catalog.subdistrict), catalogVillageId: catalog.id };
  } else {
    if (!typedName) throw new Error("กรุณากรอกชื่อหมู่บ้าน");
    if (!sourceNote) throw new Error("กรุณาระบุเหตุผลหรือที่มาสำหรับการเพิ่มแบบ Manual");
    const location = validateThaiLocation({ province: readString(formData, "province"), district: readString(formData, "district"), subdistrict: readString(formData, "subdistrict") });
    if (!location.ok) throw new Error(location.error);
    canonical = { name: typedName, moo: optionalString(formData, "moo"), province: location.province, district: location.district, subdistrict: location.subdistrict, catalogVillageId: null };
  }

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
    sourceNote,
    mode,
  };
}

export async function createVillageAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();
  const payload = await readVillagePayload(formData);
  const { mode, ...data } = payload;
  let created;
  try {
    created = await prisma.village.create({ data: { ...data, isActive: true } });
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new Error("slug นี้ถูกใช้แล้ว หรือหมู่บ้านจาก Catalog นี้ถูกเปิดใช้งานแล้ว");
    throw error;
  }
  await writeSuperAdminAuditLog({ userId: session.id, action: mode === "catalog" ? AuditAction.VILLAGE_CREATED_FROM_CATALOG : AuditAction.VILLAGE_CREATED_MANUAL, resource: "Village", resourceId: created.id, villageId: created.id, metadata: { name: created.name, slug: created.slug, sourceNote: created.sourceNote, catalogVillageId: created.catalogVillageId } });
  revalidatePath("/superadmin/villages");
  revalidatePath("/superadmin/dashboard");
}

export async function updateVillageAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();
  const id = readString(formData, "id");
  if (!id) throw new Error("ไม่พบรหัสหมู่บ้าน");
  const payload = await readVillagePayload(formData);
  const { mode, ...data } = payload;
  let updated;
  try {
    updated = await prisma.village.update({ where: { id }, data });
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new Error("slug นี้ถูกใช้แล้ว หรือหมู่บ้านจาก Catalog นี้ถูกเปิดใช้งานแล้ว");
    throw error;
  }
  await writeSuperAdminAuditLog({ userId: session.id, action: AuditAction.UPDATE, resource: "Village", resourceId: id, villageId: id, metadata: { name: updated.name, slug: updated.slug, mode, sourceNote: updated.sourceNote, catalogVillageId: updated.catalogVillageId } });
  revalidatePath("/superadmin/villages");
  revalidatePath("/superadmin/dashboard");
}

export async function searchVillageCatalogAction(input: { province: string; district: string; subdistrict: string; query?: string }) {
  await requireSuperAdminActionSession();
  const province = normalizeThaiAreaName(input.province);
  const district = normalizeThaiAreaName(input.district);
  const subdistrict = normalizeThaiAreaName(input.subdistrict);
  const query = (input.query ?? "").trim();
  if (!province || !district || !subdistrict) return { items: [], totalCount: 0 };
  const villageKeyword = normalizeThaiVillageName(query);
  const areaWhere = { province: { in: areaCandidates(province, "จ.") }, district: { in: areaCandidates(district, "อ.") }, subdistrict: { in: areaCandidates(subdistrict, "ต.") } };
  const keywordWhere = query ? { OR: [{ villageName: { contains: query, mode: "insensitive" as const } }, { villageName: { contains: villageKeyword, mode: "insensitive" as const } }, { officialCode: { contains: query, mode: "insensitive" as const } }, { moo: { contains: query, mode: "insensitive" as const } }] } : {};
  const where = { ...areaWhere, ...keywordWhere };
  const [items, totalCount] = await Promise.all([prisma.thailandVillageMaster.findMany({
    where,
    select: { id: true, officialCode: true, villageName: true, moo: true, province: true, district: true, subdistrict: true, sourceName: true, village: { select: { id: true, isActive: true } } },
    orderBy: [{ villageName: "asc" }, { moo: "asc" }],
    take: 100,
  }), prisma.thailandVillageMaster.count({ where: areaWhere })]);
  return { items, totalCount };
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
  const hasDependencies = usage._count.houses > 0 || usage._count.memberships > 0 || usage._count.news > 0 || usage._count.issues > 0 || usage._count.appointments > 0;
  if (hasDependencies) throw new Error("ลบหมู่บ้านนี้ไม่ได้เพราะมีข้อมูลใช้งานอยู่ ให้ปิดการใช้งานแทน");
  await prisma.village.delete({ where: { id } });
  await writeSuperAdminAuditLog({ userId: session.id, action: AuditAction.DELETE, resource: "Village", resourceId: id, villageId: id, metadata: { name: usage.name } });
  revalidatePath("/superadmin/villages");
  revalidatePath("/superadmin/dashboard");
}
