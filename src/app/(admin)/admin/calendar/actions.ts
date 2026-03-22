"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";

const inputSchema = z.object({
  title: z.string().min(3, "กรุณาระบุชื่อกิจกรรม"),
  description: z.string().optional(),
  location: z.string().optional(),
  startsAt: z.string().min(1, "กรุณาระบุวันเวลาเริ่ม"),
  endsAt: z.string().optional(),
  isPublic: z.string().min(1, "กรุณาเลือกการมองเห็น"),
});

type EventInput = z.infer<typeof inputSchema>;

async function requireAdminVillage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    return { ok: false as const, error: "กรุณาเข้าสู่ระบบ", villageId: "" };
  }
  if (!isAdminUser(session)) {
    return { ok: false as const, error: "ไม่มีสิทธิ์ดำเนินการ", villageId: "" };
  }

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) {
    return { ok: false as const, error: "ไม่พบหมู่บ้านของคุณ", villageId: "" };
  }

  return { ok: true as const, error: null, villageId: membership.villageId };
}

function normalizeInput(data: EventInput) {
  const parsed = inputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง",
    };
  }

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = parsed.data.endsAt?.trim() ? new Date(parsed.data.endsAt) : null;
  if (Number.isNaN(startsAt.getTime())) {
    return { ok: false as const, error: "วันเวลาเริ่มไม่ถูกต้อง" };
  }
  if (endsAt && Number.isNaN(endsAt.getTime())) {
    return { ok: false as const, error: "วันเวลาสิ้นสุดไม่ถูกต้อง" };
  }
  if (endsAt && endsAt < startsAt) {
    return { ok: false as const, error: "วันเวลาสิ้นสุดต้องมากกว่าหรือเท่ากับวันเวลาเริ่ม" };
  }

  const isPublic = parsed.data.isPublic === "PUBLIC";

  return {
    ok: true as const,
    value: {
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      location: parsed.data.location?.trim() || null,
      startsAt,
      endsAt,
      isPublic,
    },
  };
}

export async function createVillageEventAction(
  data: EventInput
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalized = normalizeInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const created = await prisma.villageEvent.create({
    data: {
      villageId: ctx.villageId,
      title: normalized.value.title,
      description: normalized.value.description,
      location: normalized.value.location,
      startsAt: normalized.value.startsAt,
      endsAt: normalized.value.endsAt,
      isPublic: normalized.value.isPublic,
    },
    select: { id: true },
  });

  return { success: true, id: created.id };
}

export async function updateVillageEventAction(
  id: string,
  data: EventInput
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalized = normalizeInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const existing = await prisma.villageEvent.findFirst({
    where: { id, villageId: ctx.villageId },
    select: { id: true },
  });
  if (!existing) {
    return { success: false, error: "ไม่พบกิจกรรมนี้หรือไม่มีสิทธิ์แก้ไข" };
  }

  await prisma.villageEvent.update({
    where: { id },
    data: {
      title: normalized.value.title,
      description: normalized.value.description,
      location: normalized.value.location,
      startsAt: normalized.value.startsAt,
      endsAt: normalized.value.endsAt,
      isPublic: normalized.value.isPublic,
    },
  });

  return { success: true };
}

export async function deleteVillageEventAction(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const existing = await prisma.villageEvent.findFirst({
    where: { id, villageId: ctx.villageId },
    select: { id: true },
  });
  if (!existing) {
    return { success: false, error: "ไม่พบกิจกรรมนี้หรือไม่มีสิทธิ์ลบ" };
  }

  await prisma.villageEvent.delete({ where: { id } });
  return { success: true };
}
