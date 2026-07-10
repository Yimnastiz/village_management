"use server";

import { PersonStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";

type PersonInput = {
  firstName: string;
  lastName: string;
  nationalId: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  status: string;
  houseId: string;
};

async function requireAdminVillage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id || !isAdminUser(session)) {
    return { ok: false as const, error: "Unauthorized", villageId: "" };
  }

  const membership = await prisma.villageMembership.findFirst({
    where: {
      userId: session.id,
      status: "ACTIVE",
      role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] },
    },
    select: { villageId: true },
  });

  if (!membership) {
    return { ok: false as const, error: "Unauthorized", villageId: "" };
  }

  return { ok: true as const, error: null, villageId: membership.villageId };
}

function normalizeInput(data: PersonInput) {
  const firstName = data.firstName.trim();
  const lastName = data.lastName.trim();
  if (firstName.length < 1 || lastName.length < 1) {
    return { ok: false as const, error: "กรุณาระบุชื่อและนามสกุล" };
  }

  if (!Object.values(PersonStatus).includes(data.status as PersonStatus)) {
    return { ok: false as const, error: "สถานะไม่ถูกต้อง" };
  }

  const dateOfBirth = data.dateOfBirth.trim() ? new Date(data.dateOfBirth) : null;
  if (data.dateOfBirth.trim() && Number.isNaN(dateOfBirth?.getTime())) {
    return { ok: false as const, error: "วันเกิดไม่ถูกต้อง" };
  }

  return {
    ok: true as const,
    value: {
      firstName,
      lastName,
      nationalId: data.nationalId.trim() || null,
      dateOfBirth,
      gender: data.gender.trim() || null,
      phone: data.phone.trim() || null,
      email: data.email.trim() || null,
      status: data.status as PersonStatus,
      houseId: data.houseId.trim() || null,
    },
  };
}

export async function createPersonAction(data: PersonInput): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalized = normalizeInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  if (normalized.value.houseId) {
    const house = await prisma.house.findFirst({
      where: { id: normalized.value.houseId, villageId: ctx.villageId },
      select: { id: true },
    });
    if (!house) return { success: false, error: "บ้านที่เลือกไม่ถูกต้อง" };
  }

  const created = await prisma.person.create({
    data: {
      villageId: ctx.villageId,
      ...normalized.value,
    },
    select: { id: true },
  });

  revalidatePath("/admin/population/people");
  return { success: true, id: created.id };
}

export async function updatePersonAction(personId: string, data: PersonInput): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalized = normalizeInput(data);
  if (!normalized.ok) return { success: false, error: normalized.error };

  const person = await prisma.person.findFirst({
    where: { id: personId, villageId: ctx.villageId },
    select: { id: true },
  });
  if (!person) return { success: false, error: "ไม่พบบุคคล" };

  if (normalized.value.houseId) {
    const house = await prisma.house.findFirst({
      where: { id: normalized.value.houseId, villageId: ctx.villageId },
      select: { id: true },
    });
    if (!house) return { success: false, error: "บ้านที่เลือกไม่ถูกต้อง" };
  }

  await prisma.person.update({
    where: { id: personId },
    data: normalized.value,
  });

  revalidatePath("/admin/population/people");
  revalidatePath(`/admin/population/people/${personId}`);
  return { success: true };
}

export async function deletePersonAction(personId: string): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireAdminVillage();
  if (!ctx.ok) return { success: false, error: ctx.error };

  const person = await prisma.person.findFirst({
    where: { id: personId, villageId: ctx.villageId },
    select: { id: true },
  });
  if (!person) return { success: false, error: "ไม่พบบุคคล" };

  await prisma.person.delete({ where: { id: personId } });

  revalidatePath("/admin/population/people");
  return { success: true };
}
