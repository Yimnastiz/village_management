"use server";

import { AuditAction, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminActionSession, writeSuperAdminAuditLog } from "@/lib/superadmin";
import { validateThaiGeographySelection } from "@/lib/thai-geography";
import { normalizeVillageSlug } from "@/lib/village-slug";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePhone(value: string): string | null {
  const normalized = value.replace(/[\s-]/g, "").trim();
  return normalized || null;
}

function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(candidate);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("เว็บไซต์ต้องเป็น URL http หรือ https");
  return url.toString();
}

async function normalizeVillageForm(formData: FormData, existingId?: string) {
  const name = readString(formData, "name");
  const slug = normalizeVillageSlug(readString(formData, "slug") || name);
  const province = readString(formData, "province");
  const district = readString(formData, "district");
  const subdistrict = readString(formData, "subdistrict");
  const email = emptyToNull(readString(formData, "email"));
  const websiteRaw = readString(formData, "website");
  const phone = normalizePhone(readString(formData, "phone"));

  if (!name) throw new Error("กรุณากรอกชื่อหมู่บ้าน");
  if (!slug) throw new Error("กรุณากรอก slug ที่ถูกต้อง");
  if (/[/?#%\\]/.test(slug)) throw new Error("slug มีอักขระที่ใช้กับ route ไม่ได้");

  const geography = validateThaiGeographySelection({ province, district, subdistrict });
  if (!geography.ok) throw new Error(geography.error);

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("อีเมลไม่ถูกต้อง");
  }

  let website: string | null = null;
  try {
    website = normalizeUrl(websiteRaw);
  } catch {
    throw new Error("เว็บไซต์ต้องเป็น URL ที่ถูกต้อง");
  }

  const duplicate = await prisma.village.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (duplicate && duplicate.id !== existingId) {
    throw new Error("slug นี้ถูกใช้แล้ว");
  }

  return {
    name,
    slug,
    description: emptyToNull(readString(formData, "description")),
    province,
    district,
    subdistrict,
    address: emptyToNull(readString(formData, "address")),
    phone,
    email,
    website,
  };
}

export async function createVillageAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();
  const input = await normalizeVillageForm(formData);

  const created = await prisma.village.create({
    data: {
      ...input,
      isActive: readString(formData, "isActive") !== "false",
    },
  });

  await writeSuperAdminAuditLog({
    userId: session.id,
    action: AuditAction.CREATE,
    resource: "Village",
    resourceId: created.id,
    metadata: { actorRole: "SUPERADMIN", actionName: "SUPERADMIN_VILLAGE_CREATED", name: created.name, slug: created.slug },
    villageId: created.id,
  });

  revalidatePath("/superadmin/villages");
  revalidatePath("/superadmin/dashboard");
}

export async function updateVillageAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();
  const id = readString(formData, "id");
  if (!id) throw new Error("ไม่พบรหัสหมู่บ้าน");

  const existing = await prisma.village.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, province: true, district: true, subdistrict: true },
  });
  if (!existing) throw new Error("ไม่พบหมู่บ้าน");

  const input = await normalizeVillageForm(formData, id);
  const updated = await prisma.village.update({
    where: { id },
    data: input,
  });

  await writeSuperAdminAuditLog({
    userId: session.id,
    action: AuditAction.UPDATE,
    resource: "Village",
    resourceId: id,
    metadata: {
      actorRole: "SUPERADMIN",
      actionName: "SUPERADMIN_VILLAGE_UPDATED",
      oldValue: existing,
      newValue: { name: updated.name, slug: updated.slug, province: updated.province, district: updated.district, subdistrict: updated.subdistrict },
    },
    villageId: id,
  });

  revalidatePath("/superadmin/villages");
  revalidatePath(`/superadmin/villages/${id}`);
  revalidatePath("/superadmin/dashboard");
}

export async function toggleVillageActiveAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();
  const id = readString(formData, "id");
  const nextActive = readString(formData, "nextActive") === "true";
  if (!id) throw new Error("ไม่พบรหัสหมู่บ้าน");

  const updated = await prisma.village.update({
    where: { id },
    data: { isActive: nextActive },
    select: { id: true, name: true, isActive: true },
  });

  await writeSuperAdminAuditLog({
    userId: session.id,
    action: AuditAction.UPDATE,
    resource: "VillageStatus",
    resourceId: id,
    metadata: { actorRole: "SUPERADMIN", actionName: "SUPERADMIN_VILLAGE_STATUS_CHANGED", name: updated.name, isActive: updated.isActive },
    villageId: id,
  });

  revalidatePath("/superadmin/villages");
  revalidatePath("/superadmin/dashboard");
}

export async function deleteVillageAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();
  const id = readString(formData, "id");
  if (!id) throw new Error("ไม่พบรหัสหมู่บ้าน");

  const usage = await prisma.village.findUnique({
    where: { id },
    select: {
      name: true,
      province: true,
      district: true,
      subdistrict: true,
      _count: {
        select: {
          memberships: true,
          houses: true,
          bindingRequests: true,
          news: true,
          contactDirectories: true,
          villagePlaces: true,
          villageEvents: true,
          transparencyRecords: true,
          auditLogs: true,
          issues: true,
          appointments: true,
        },
      },
    },
  });

  if (!usage) throw new Error("ไม่พบหมู่บ้าน");

  const counts = usage._count;
  const dependencyCount = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (dependencyCount > 0) {
    throw new Error("ลบหมู่บ้านนี้แบบถาวรไม่ได้ เพราะมีข้อมูลใช้งานอยู่ ให้ปิดการใช้งานแทน");
  }

  await prisma.village.delete({ where: { id } });

  await writeSuperAdminAuditLog({
    userId: session.id,
    action: AuditAction.DELETE,
    resource: "Village",
    resourceId: id,
    metadata: {
      actorRole: "SUPERADMIN",
      actionName: "SUPERADMIN_VILLAGE_DELETED",
      oldValue: {
        name: usage.name,
        province: usage.province,
        district: usage.district,
        subdistrict: usage.subdistrict,
      } satisfies Prisma.InputJsonObject,
    },
    villageId: id,
  });

  revalidatePath("/superadmin/villages");
  revalidatePath("/superadmin/dashboard");
}

