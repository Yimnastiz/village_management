"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminActionSession, writeSuperAdminAuditLog } from "@/lib/superadmin";
import { validateThaiLocation } from "@/lib/thai-geography";
import { normalizeVillageSlugInput } from "@/lib/village-slug";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(formData: FormData, key: string): string | null {
  const value = readString(formData, key);
  return value.length > 0 ? value : null;
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function readVillagePayload(formData: FormData) {
  const name = readString(formData, "name");
  const slug = normalizeVillageSlugInput(readString(formData, "slug") || name);
  const location = validateThaiLocation({
    province: readString(formData, "province"),
    district: readString(formData, "district"),
    subdistrict: readString(formData, "subdistrict"),
  });

  if (!name) {
    throw new Error("กรุณากรอกชื่อหมู่บ้าน");
  }

  if (!slug) {
    throw new Error("กรุณากรอก slug ที่ถูกต้อง");
  }

  if (!location.ok) {
    throw new Error(location.error);
  }

  return {
    name,
    slug,
    description: optionalString(formData, "description"),
    province: location.province,
    district: location.district,
    subdistrict: location.subdistrict,
    address: optionalString(formData, "address"),
    phone: optionalString(formData, "phone"),
    email: optionalString(formData, "email"),
    website: optionalString(formData, "website"),
  };
}

export async function createVillageAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();
  const payload = readVillagePayload(formData);

  let created;
  try {
    created = await prisma.village.create({
      data: {
        ...payload,
        isActive: true,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("slug นี้ถูกใช้แล้ว กรุณาใช้ slug อื่น");
    }
    throw error;
  }

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
  if (!id) {
    throw new Error("ไม่พบรหัสหมู่บ้าน");
  }

  const payload = readVillagePayload(formData);

  let updated;
  try {
    updated = await prisma.village.update({
      where: { id },
      data: payload,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("slug นี้ถูกใช้แล้ว กรุณาใช้ slug อื่น");
    }
    throw error;
  }

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
