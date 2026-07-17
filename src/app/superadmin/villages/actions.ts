"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminActionSession, writeSuperAdminAuditLog } from "@/lib/superadmin";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createVillageAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();

  const name = readString(formData, "name");
  const slug = normalizeSlug(readString(formData, "slug") || name);

  if (!name) {
    throw new Error("กรุณากรอกชื่อหมู่บ้าน");
  }
  if (!slug) {
    throw new Error("กรุณากรอก slug ที่ถูกต้อง");
  }

  const created = await prisma.village.create({
    data: {
      name,
      slug,
      description: readString(formData, "description") || null,
      province: readString(formData, "province") || null,
      district: readString(formData, "district") || null,
      subdistrict: readString(formData, "subdistrict") || null,
      address: readString(formData, "address") || null,
      phone: readString(formData, "phone") || null,
      email: readString(formData, "email") || null,
      website: readString(formData, "website") || null,
      isActive: true,
    },
  });

  await writeSuperAdminAuditLog({
    userId: session.id,
    action: AuditAction.CREATE,
    resource: "Village",
    resourceId: created.id,
    metadata: { name: created.name, slug: created.slug },
    villageId: created.id,
  });

  revalidatePath("/superadmin/villages");
  revalidatePath("/superadmin/dashboard");
}

export async function updateVillageAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();

  const id = readString(formData, "id");
  const name = readString(formData, "name");
  const slug = normalizeSlug(readString(formData, "slug") || name);

  if (!id) {
    throw new Error("ไม่พบรหัสหมู่บ้าน");
  }
  if (!name || !slug) {
    throw new Error("ข้อมูลหมู่บ้านไม่ครบถ้วน");
  }

  const updated = await prisma.village.update({
    where: { id },
    data: {
      name,
      slug,
      description: readString(formData, "description") || null,
      province: readString(formData, "province") || null,
      district: readString(formData, "district") || null,
      subdistrict: readString(formData, "subdistrict") || null,
      address: readString(formData, "address") || null,
      phone: readString(formData, "phone") || null,
      email: readString(formData, "email") || null,
      website: readString(formData, "website") || null,
    },
  });

  await writeSuperAdminAuditLog({
    userId: session.id,
    action: AuditAction.UPDATE,
    resource: "Village",
    resourceId: id,
    metadata: { name: updated.name, slug: updated.slug },
    villageId: id,
  });

  revalidatePath("/superadmin/villages");
  revalidatePath("/superadmin/dashboard");
}

export async function toggleVillageActiveAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();

  const id = readString(formData, "id");
  const nextActive = readString(formData, "nextActive") === "true";
  if (!id) {
    throw new Error("ไม่พบรหัสหมู่บ้าน");
  }

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
    metadata: { name: updated.name, isActive: updated.isActive },
    villageId: id,
  });

  revalidatePath("/superadmin/villages");
  revalidatePath("/superadmin/dashboard");
}

export async function deleteVillageAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();

  const id = readString(formData, "id");
  if (!id) {
    throw new Error("ไม่พบรหัสหมู่บ้าน");
  }

  const usage = await prisma.village.findUnique({
    where: { id },
    select: {
      name: true,
      _count: {
        select: {
          houses: true,
          memberships: true,
          news: true,
          issues: true,
          appointments: true,
        },
      },
    },
  });

  if (!usage) {
    throw new Error("ไม่พบหมู่บ้าน");
  }

  const hasDependencies =
    usage._count.houses > 0 ||
    usage._count.memberships > 0 ||
    usage._count.news > 0 ||
    usage._count.issues > 0 ||
    usage._count.appointments > 0;

  if (hasDependencies) {
    throw new Error("ลบหมู่บ้านนี้ไม่ได้เพราะมีข้อมูลใช้งานอยู่ ให้ปิดการใช้งานแทน");
  }

  await prisma.village.delete({ where: { id } });

  await writeSuperAdminAuditLog({
    userId: session.id,
    action: AuditAction.DELETE,
    resource: "Village",
    resourceId: id,
    metadata: { name: usage.name },
    villageId: id,
  });

  revalidatePath("/superadmin/villages");
  revalidatePath("/superadmin/dashboard");
}
