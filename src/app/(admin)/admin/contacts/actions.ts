"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";

const inputSchema = z.object({
  name: z.string().min(2, "กรุณาระบุชื่อผู้ติดต่อ"),
  role: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  category: z.string().optional(),
  sortOrder: z.string().optional(),
  isPublic: z.string().min(1, "กรุณาเลือกการมองเห็น"),
});

type ContactInput = z.infer<typeof inputSchema>;

async function requireAdminVillage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { ok: false as const, error: "กรุณาเข้าสู่ระบบ", villageId: "" };
  if (!isAdminUser(session)) return { ok: false as const, error: "ไม่มีสิทธิ์ดำเนินการ", villageId: "" };

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) return { ok: false as const, error: "ไม่พบหมู่บ้านของคุณ", villageId: "" };

  return { ok: true as const, error: null, villageId: membership.villageId };
}

function normalizeInput(data: ContactInput) {
  const parsed = inputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง",
    };
  }

  const sortOrderRaw = parsed.data.sortOrder?.trim();
  const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : 0;
  if (Number.isNaN(sortOrder)) {
    return { ok: false as const, error: "ลำดับการแสดงผลไม่ถูกต้อง" };
  }

  return {
    ok: true as const,
    value: {
      name: parsed.data.name.trim(),
      role: parsed.data.role?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      email: parsed.data.email?.trim() || null,
      address: parsed.data.address?.trim() || null,
      category: parsed.data.category?.trim() || null,
      sortOrder,
      isPublic: parsed.data.isPublic === "PUBLIC",
    },
  };
}

export async function createContactAction(
  data: ContactInput
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalized = normalizeInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const created = await prisma.contactDirectory.create({
    data: {
      villageId: ctx.villageId,
      name: normalized.value.name,
      role: normalized.value.role,
      phone: normalized.value.phone,
      email: normalized.value.email,
      address: normalized.value.address,
      category: normalized.value.category,
      sortOrder: normalized.value.sortOrder,
      isPublic: normalized.value.isPublic,
    },
    select: { id: true },
  });

  return { success: true, id: created.id };
}

export async function updateContactAction(
  id: string,
  data: ContactInput
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalized = normalizeInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const existing = await prisma.contactDirectory.findFirst({
    where: { id, villageId: ctx.villageId },
    select: { id: true },
  });
  if (!existing) return { success: false, error: "ไม่พบผู้ติดต่อหรือไม่มีสิทธิ์แก้ไข" };

  await prisma.contactDirectory.update({
    where: { id },
    data: {
      name: normalized.value.name,
      role: normalized.value.role,
      phone: normalized.value.phone,
      email: normalized.value.email,
      address: normalized.value.address,
      category: normalized.value.category,
      sortOrder: normalized.value.sortOrder,
      isPublic: normalized.value.isPublic,
    },
  });

  return { success: true };
}

export async function deleteContactAction(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const existing = await prisma.contactDirectory.findFirst({
    where: { id, villageId: ctx.villageId },
    select: { id: true },
  });
  if (!existing) return { success: false, error: "ไม่พบผู้ติดต่อหรือไม่มีสิทธิ์ลบ" };

  await prisma.contactDirectory.delete({ where: { id } });
  return { success: true };
}
