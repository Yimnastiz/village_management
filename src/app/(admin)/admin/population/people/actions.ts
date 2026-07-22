"use server";

import { AuditAction, MembershipStatus, MovementType, PersonStatus, VillageMembershipRole } from "@prisma/client";
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

  const created = await prisma.$transaction(async (tx) => {
    const person = await tx.person.create({ data: { villageId: ctx.villageId, ...normalized.value }, select: { id: true } });
    if (normalized.value.houseId) {
      await tx.personMovement.create({ data: { personId: person.id, houseId: normalized.value.houseId, movementType: MovementType.MOVE_IN, date: new Date() } });
      if (normalized.value.phone) {
        const user = await tx.user.findUnique({ where: { phoneNumber: normalized.value.phone }, select: { id: true, systemRole: true } });
        if (user && user.systemRole !== "SUPERADMIN") {
          const activeAdmin = await tx.villageMembership.findFirst({ where: { userId: user.id, villageId: ctx.villageId, status: MembershipStatus.ACTIVE, role: { in: [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN, VillageMembershipRole.COMMITTEE] } }, select: { id: true } });
          if (!activeAdmin) await tx.villageMembership.upsert({ where: { userId_villageId: { userId: user.id, villageId: ctx.villageId } }, update: { role: VillageMembershipRole.RESIDENT, status: MembershipStatus.ACTIVE, houseId: normalized.value.houseId }, create: { userId: user.id, villageId: ctx.villageId, role: VillageMembershipRole.RESIDENT, status: MembershipStatus.ACTIVE, houseId: normalized.value.houseId } });
        }
      }
    }
    await tx.auditLog.create({ data: { userId: (await getSessionContextFromServerCookies())!.id, villageId: ctx.villageId, action: AuditAction.CREATE, resource: "Person", resourceId: person.id, metadata: { actionName: "PERSON_CREATED", houseId: normalized.value.houseId } } });
    return person;
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
    select: { id: true, houseId: true },
  });
  if (!person) return { success: false, error: "ไม่พบบุคคล" };

  if (normalized.value.houseId) {
    const house = await prisma.house.findFirst({
      where: { id: normalized.value.houseId, villageId: ctx.villageId },
      select: { id: true },
    });
    if (!house) return { success: false, error: "บ้านที่เลือกไม่ถูกต้อง" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.person.update({ where: { id: personId }, data: normalized.value });
    if (person.houseId !== normalized.value.houseId) {
      if (person.houseId) await tx.personMovement.create({ data: { personId, houseId: person.houseId, movementType: MovementType.MOVE_OUT, date: new Date() } });
      if (normalized.value.houseId) await tx.personMovement.create({ data: { personId, houseId: normalized.value.houseId, movementType: MovementType.MOVE_IN, date: new Date() } });
    }
    await tx.auditLog.create({ data: { userId: (await getSessionContextFromServerCookies())!.id, villageId: ctx.villageId, action: AuditAction.UPDATE, resource: "Person", resourceId: personId, metadata: { actionName: "PERSON_UPDATED", previousHouseId: person.houseId, houseId: normalized.value.houseId } } });
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
    select: { id: true, houseId: true },
  });
  if (!person) return { success: false, error: "ไม่พบบุคคล" };

  await prisma.$transaction(async (tx) => {
    await tx.person.update({ where: { id: personId }, data: { status: PersonStatus.MOVED_OUT } });
    if (person.houseId) await tx.personMovement.create({ data: { personId, houseId: person.houseId, movementType: MovementType.MOVE_OUT, date: new Date() } });
    await tx.auditLog.create({ data: { userId: (await getSessionContextFromServerCookies())!.id, villageId: ctx.villageId, action: AuditAction.UPDATE, resource: "Person", resourceId: personId, metadata: { actionName: "PERSON_MOVED_OUT", houseId: person.houseId } } });
  });

  revalidatePath("/admin/population/people");
  return { success: true };
}
