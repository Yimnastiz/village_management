import {
  AuditAction,
  HouseholdOccupancyStatus,
  HouseSourceType,
  MembershipStatus,
  MovementType,
  NotificationType,
  PersonStatus,
  Prisma,
  VillageMembershipRole,
} from "@prisma/client";
import { isValidHouseNumber, normalizeHouseNumber } from "@/lib/house-number";
import { prisma } from "@/lib/prisma";

export type PopulationActor = { id: string | null; role: "ADMIN" | "SUPERADMIN" };
export type VillagePersonInput = {
  firstName: string; lastName: string; nationalId: string; dateOfBirth: string;
  gender: string; phone: string; email: string; status?: string; houseId: string; reason?: string;
};
// occupancyStatus remains required by the current schema, but is deliberately
// not part of the population-management workflow or UI.
export type VillageHouseInput = { houseNumber: string; address?: string; sourceNote?: string };

export class PopulationValidationError extends Error {}

export async function assertTargetVillage(villageId: string) {
  if (!villageId) throw new PopulationValidationError("ต้องระบุหมู่บ้านเป้าหมาย");
  const village = await prisma.village.findUnique({ where: { id: villageId }, select: { id: true, name: true } });
  if (!village) throw new PopulationValidationError("ไม่พบหมู่บ้านเป้าหมาย");
  return village;
}

function normalizePersonInput(data: VillagePersonInput) {
  const firstName = data.firstName.trim();
  const lastName = data.lastName.trim();
  if (!firstName || !lastName) throw new PopulationValidationError("กรุณาระบุชื่อและนามสกุล");
  const dateOfBirth = data.dateOfBirth.trim() ? new Date(data.dateOfBirth) : null;
  if (dateOfBirth && Number.isNaN(dateOfBirth.getTime())) throw new PopulationValidationError("วันเกิดไม่ถูกต้อง");
  const phone = data.phone.trim().replace(/[\s-]/g, "") || null;
  if (phone && !/^\+?\d{9,15}$/.test(phone)) throw new PopulationValidationError("รูปแบบเบอร์โทรไม่ถูกต้อง");
  return { firstName, lastName, nationalId: data.nationalId.trim() || null, dateOfBirth, gender: data.gender.trim() || null, phone, email: data.email.trim() || null, houseId: data.houseId.trim() || null };
}

async function assertHouseInVillage(tx: Prisma.TransactionClient, villageId: string, houseId: string | null) {
  if (!houseId) return;
  const house = await tx.house.findFirst({ where: { id: houseId, villageId }, select: { id: true } });
  if (!house) throw new PopulationValidationError("บ้านที่เลือกไม่ได้อยู่ในหมู่บ้านนี้");
}

export async function createVillageHouse(villageId: string, input: VillageHouseInput, actor: PopulationActor) {
  await assertTargetVillage(villageId);
  const houseNumber = input.houseNumber.trim();
  const normalizedHouseNumber = normalizeHouseNumber(houseNumber);
  if (!isValidHouseNumber(normalizedHouseNumber)) throw new PopulationValidationError("รูปแบบเลขที่บ้านไม่ถูกต้อง");
  const occupancyStatus = HouseholdOccupancyStatus.OCCUPIED;
  try {
    return await prisma.$transaction(async (tx) => {
      const house = await tx.house.create({ data: { villageId, houseNumber, normalizedHouseNumber, address: input.address?.trim() || null, occupancyStatus, sourceType: actor.role === "SUPERADMIN" ? HouseSourceType.SUPERADMIN_CREATED : HouseSourceType.ADMIN_CREATED, sourceNote: input.sourceNote?.trim() || null, verifiedByUserId: actor.id, verifiedAt: new Date() }, select: { id: true } });
      await tx.auditLog.create({ data: { userId: actor.id, villageId, action: AuditAction.CREATE, resource: "House", resourceId: house.id, metadata: { actorRole: actor.role, actorType: actor.role === "SUPERADMIN" ? "SUPERADMIN_ENV" : undefined, actionName: "HOUSE_CREATED", houseNumber, normalizedHouseNumber, reason: input.sourceNote?.trim() || null } } });
      return house;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new PopulationValidationError("เลขที่บ้านนี้มีอยู่แล้วในหมู่บ้าน");
    throw error;
  }
}

export async function updateVillageHouse(villageId: string, houseId: string, input: VillageHouseInput, actor: PopulationActor) {
  const houseNumber = input.houseNumber.trim();
  const normalizedHouseNumber = normalizeHouseNumber(houseNumber);
  if (!isValidHouseNumber(normalizedHouseNumber)) throw new PopulationValidationError("รูปแบบเลขที่บ้านไม่ถูกต้อง");
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.house.findFirst({ where: { id: houseId, villageId }, select: { id: true, houseNumber: true, address: true } });
      if (!current) throw new PopulationValidationError("ไม่พบบ้านในหมู่บ้านนี้");
      const result = await tx.house.updateMany({ where: { id: houseId, villageId }, data: { houseNumber, normalizedHouseNumber, address: input.address?.trim() || null, sourceNote: input.sourceNote?.trim() || null } });
      if (result.count !== 1) throw new PopulationValidationError("ไม่สามารถแก้ไขบ้านข้ามหมู่บ้านได้");
      await tx.auditLog.create({ data: { userId: actor.id, villageId, action: AuditAction.UPDATE, resource: "House", resourceId: houseId, metadata: { actorRole: actor.role, actionName: "HOUSE_UPDATED", reason: input.sourceNote?.trim() || null, oldValue: current, newValue: { houseNumber, address: input.address?.trim() || null } } } });
      return { statusChanged: false };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new PopulationValidationError("เลขที่บ้านนี้มีอยู่แล้วในหมู่บ้าน");
    throw error;
  }
}

export async function deleteVillageHouse(villageId: string, houseId: string, reason: string, actor: PopulationActor) {
  if (reason.trim().length < 3) throw new PopulationValidationError("กรุณาระบุเหตุผลการลบบ้าน");
  await prisma.$transaction(async (tx) => {
    const house = await tx.house.findFirst({ where: { id: houseId, villageId }, select: { id: true, houseNumber: true, _count: { select: { persons: true, memberships: true, bindingRequests: true, correctionRequests: true, movementHistory: true } } } });
    if (!house) throw new PopulationValidationError("ไม่พบบ้านในหมู่บ้านนี้");
    const counts = house._count;
    if (counts.persons || counts.memberships || counts.bindingRequests || counts.correctionRequests || counts.movementHistory) throw new PopulationValidationError("ไม่สามารถลบบ้านนี้ได้ เนื่องจากมีประชากร สมาชิก หรือประวัติที่เชื่อมโยงอยู่");
    await tx.house.delete({ where: { id: house.id } });
    await tx.auditLog.create({ data: { userId: actor.id, villageId, action: AuditAction.DELETE, resource: "House", resourceId: house.id, metadata: { actorRole: actor.role, actionName: "HOUSE_DELETED", houseNumber: house.houseNumber, reason: reason.trim() } } });
  });
}

export async function createVillagePerson(villageId: string, data: VillagePersonInput, actor: PopulationActor) {
  await assertTargetVillage(villageId);
  const value = normalizePersonInput(data);
  return prisma.$transaction(async (tx) => {
    await assertHouseInVillage(tx, villageId, value.houseId);
    if (value.nationalId && await tx.person.findFirst({ where: { villageId, nationalId: value.nationalId }, select: { id: true } })) throw new PopulationValidationError("เลขบัตรประชาชนนี้มีอยู่ในทะเบียนแล้ว");
    const person = await tx.person.create({ data: { villageId, ...value, status: PersonStatus.ACTIVE }, select: { id: true } });
    if (value.houseId) await tx.personMovement.create({ data: { personId: person.id, houseId: value.houseId, movementType: MovementType.MOVE_IN, date: new Date() } });
    if (value.houseId && value.phone) {
      const user = await tx.user.findUnique({ where: { phoneNumber: value.phone }, select: { id: true, systemRole: true } });
      if (user?.systemRole !== "SUPERADMIN" && user) {
        const activeAdmin = await tx.villageMembership.findFirst({ where: { userId: user.id, villageId, status: MembershipStatus.ACTIVE, role: { in: [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN, VillageMembershipRole.COMMITTEE] } }, select: { id: true } });
        if (!activeAdmin) await tx.villageMembership.upsert({ where: { userId_villageId: { userId: user.id, villageId } }, update: { role: VillageMembershipRole.RESIDENT, status: MembershipStatus.ACTIVE, houseId: value.houseId }, create: { userId: user.id, villageId, role: VillageMembershipRole.RESIDENT, status: MembershipStatus.ACTIVE, houseId: value.houseId } });
      }
    }
    await tx.auditLog.create({ data: { userId: actor.id, villageId, action: AuditAction.CREATE, resource: "Person", resourceId: person.id, metadata: { actorRole: actor.role, actionName: "PERSON_CREATED", houseId: value.houseId } } });
    return person;
  });
}

export async function updateVillagePerson(villageId: string, personId: string, data: VillagePersonInput, actor: PopulationActor) {
  const value = normalizePersonInput(data);
  return prisma.$transaction(async (tx) => {
    const person = await tx.person.findFirst({ where: { id: personId, villageId }, select: { id: true, userId: true, houseId: true, status: true, firstName: true, lastName: true, nationalId: true, dateOfBirth: true, gender: true, phone: true, email: true } });
    if (!person) throw new PopulationValidationError("ไม่พบบุคคลในหมู่บ้านนี้");
    if (person.userId && (person.firstName !== value.firstName || person.lastName !== value.lastName || person.nationalId !== value.nationalId || person.phone !== value.phone)) throw new PopulationValidationError("ข้อมูลระบุตัวตนและเบอร์โทรนี้เชื่อมกับบัญชีผู้ใช้แล้ว กรุณาดำเนินการผ่านขั้นตอนแก้ไขบัญชีหรือให้ Super Admin ตรวจสอบ");
    if (person.status === PersonStatus.MOVED_OUT && value.houseId) throw new PopulationValidationError("บุคคลนี้ย้ายออกจากทะเบียนแล้ว หากกลับมาอยู่ใหม่ให้ส่งคำขอผูกเลขบ้านใหม่");
    await assertHouseInVillage(tx, villageId, value.houseId);
    if (value.nationalId && await tx.person.findFirst({ where: { villageId, nationalId: value.nationalId, id: { not: personId } }, select: { id: true } })) throw new PopulationValidationError("เลขบัตรประชาชนนี้มีอยู่ในทะเบียนแล้ว");
    const houseChanged = person.houseId !== value.houseId;
    const reason = data.reason?.trim() || "";
    if (houseChanged && reason.length < 5) throw new PopulationValidationError("กรุณาระบุเหตุผลการเปลี่ยนบ้านอย่างน้อย 5 ตัวอักษร");
    const result = await tx.person.updateMany({ where: { id: personId, villageId }, data: value });
    if (result.count !== 1) throw new PopulationValidationError("ไม่สามารถแก้ไขบุคคลข้ามหมู่บ้านได้");
    if (houseChanged) {
      if (person.houseId) await tx.personMovement.create({ data: { personId, houseId: person.houseId, movementType: MovementType.MOVE_OUT, date: new Date(), note: reason } });
      if (value.houseId) await tx.personMovement.create({ data: { personId, houseId: value.houseId, movementType: MovementType.MOVE_IN, date: new Date(), note: reason } });
      if (person.userId) {
        await tx.villageMembership.updateMany({ where: { userId: person.userId, villageId, role: VillageMembershipRole.RESIDENT, status: MembershipStatus.ACTIVE }, data: { houseId: value.houseId } });
      }
    }
    await tx.auditLog.create({ data: { userId: actor.id, villageId, action: AuditAction.UPDATE, resource: "Person", resourceId: personId, metadata: { actorRole: actor.role, actionName: houseChanged ? "PERSON_MOVED_HOUSE" : "PERSON_UPDATED", reason: reason || null, changedFields: Object.keys(value).filter((key) => person[key as keyof typeof person] !== value[key as keyof typeof value]), oldHouseId: person.houseId, newHouseId: value.houseId, previousStatus: person.status } } });
    return { moved: houseChanged };
  });
}

export async function moveOutVillagePerson(villageId: string, personId: string, reason: string, actor: PopulationActor) {
  if (reason.trim().length < 5) throw new PopulationValidationError("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร");
  await prisma.$transaction(async (tx) => {
    const person = await tx.person.findFirst({ where: { id: personId, villageId }, select: { id: true, userId: true, houseId: true, status: true } });
    if (!person) throw new PopulationValidationError("ไม่พบบุคคลในหมู่บ้านนี้");
    if (person.status === PersonStatus.MOVED_OUT) throw new PopulationValidationError("บุคคลนี้ถูกย้ายออกจากทะเบียนแล้ว");
    const linkedMembership = person.userId ? await tx.villageMembership.findUnique({ where: { userId_villageId: { userId: person.userId, villageId } }, select: { role: true, status: true, houseId: true } }) : null;
    if (linkedMembership && linkedMembership.role !== VillageMembershipRole.RESIDENT) throw new PopulationValidationError("บัญชีผู้ใช้นี้มีบทบาทผู้ดูแลหมู่บ้าน จึงไม่สามารถย้ายออกผ่านรายการประชากรได้");
    const updated = await tx.person.updateMany({ where: { id: personId, villageId, status: { not: PersonStatus.MOVED_OUT } }, data: { status: PersonStatus.MOVED_OUT, houseId: null } });
    if (updated.count !== 1) throw new PopulationValidationError("ไม่สามารถยกเลิกบุคคลข้ามหมู่บ้านได้");
    if (person.houseId) await tx.personMovement.create({ data: { personId, houseId: person.houseId, movementType: MovementType.MOVE_OUT, date: new Date(), note: reason.trim() } });
    if (person.userId && linkedMembership?.role === VillageMembershipRole.RESIDENT) {
      await tx.villageMembership.updateMany({ where: { userId: person.userId, villageId, role: VillageMembershipRole.RESIDENT }, data: { status: MembershipStatus.SUSPENDED, houseId: null, joinedAt: null } });
      await tx.authSession.updateMany({ where: { userId: person.userId, activeVillageId: villageId, expiresAt: { gt: new Date() } }, data: { activeVillageId: null } });
      await tx.notification.create({ data: { userId: person.userId, villageId, type: NotificationType.SYSTEM, title: "สถานะทะเบียนของคุณมีการเปลี่ยนแปลง", body: "คุณถูกย้ายออกจากทะเบียนบ้านของหมู่บ้านนี้ หากต้องการกลับมาใช้งานในฐานะลูกบ้าน กรุณาส่งคำขอผูกเลขบ้านใหม่", metadata: { actionUrl: "/resident/binding", actionLabel: "ส่งคำขอผูกเลขบ้านใหม่", personId } } });
    }
    await tx.auditLog.create({ data: { userId: actor.id, villageId, action: AuditAction.UPDATE, resource: "Person", resourceId: personId, metadata: { actorRole: actor.role, actionName: "PERSON_MOVED_OUT", personId, userId: person.userId, oldHouseId: person.houseId, reason: reason.trim(), previousMembershipStatus: linkedMembership?.status ?? null, newMembershipStatus: linkedMembership?.role === VillageMembershipRole.RESIDENT ? MembershipStatus.SUSPENDED : null } } });
  });
}
