import {
  AuditAction,
  HouseholdOccupancyStatus,
  HouseSourceType,
  MembershipStatus,
  MovementType,
  PersonStatus,
  Prisma,
  VillageMembershipRole,
} from "@prisma/client";
import { isValidHouseNumber, normalizeHouseNumber } from "@/lib/house-number";
import { prisma } from "@/lib/prisma";

export type PopulationActor = { id: string; role: "ADMIN" | "SUPERADMIN" };
export type VillagePersonInput = {
  firstName: string; lastName: string; nationalId: string; dateOfBirth: string;
  gender: string; phone: string; email: string; status: string; houseId: string;
};
export type VillageHouseInput = { houseNumber: string; address?: string; occupancyStatus?: string; sourceNote?: string };

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
  if (!Object.values(PersonStatus).includes(data.status as PersonStatus)) throw new PopulationValidationError("สถานะบุคคลไม่ถูกต้อง");
  const dateOfBirth = data.dateOfBirth.trim() ? new Date(data.dateOfBirth) : null;
  if (dateOfBirth && Number.isNaN(dateOfBirth.getTime())) throw new PopulationValidationError("วันเกิดไม่ถูกต้อง");
  return { firstName, lastName, nationalId: data.nationalId.trim() || null, dateOfBirth, gender: data.gender.trim() || null, phone: data.phone.trim() || null, email: data.email.trim() || null, status: data.status as PersonStatus, houseId: data.houseId.trim() || null };
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
  const occupancyStatus = (input.occupancyStatus || HouseholdOccupancyStatus.OCCUPIED) as HouseholdOccupancyStatus;
  if (!Object.values(HouseholdOccupancyStatus).includes(occupancyStatus)) throw new PopulationValidationError("สถานะบ้านไม่ถูกต้อง");
  try {
    return await prisma.$transaction(async (tx) => {
      const house = await tx.house.create({ data: { villageId, houseNumber, normalizedHouseNumber, address: input.address?.trim() || null, occupancyStatus, sourceType: actor.role === "SUPERADMIN" ? HouseSourceType.SUPERADMIN_CREATED : HouseSourceType.ADMIN_CREATED, sourceNote: input.sourceNote?.trim() || null, verifiedByUserId: actor.id, verifiedAt: new Date() }, select: { id: true } });
      await tx.auditLog.create({ data: { userId: actor.id, villageId, action: AuditAction.CREATE, resource: "House", resourceId: house.id, metadata: { actorRole: actor.role, actionName: "HOUSE_CREATED", houseNumber, normalizedHouseNumber, reason: input.sourceNote?.trim() || null } } });
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
  const occupancyStatus = (input.occupancyStatus || HouseholdOccupancyStatus.OCCUPIED) as HouseholdOccupancyStatus;
  if (!Object.values(HouseholdOccupancyStatus).includes(occupancyStatus)) throw new PopulationValidationError("สถานะบ้านไม่ถูกต้อง");
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.house.findFirst({ where: { id: houseId, villageId }, select: { id: true, houseNumber: true, occupancyStatus: true, address: true } });
      if (!current) throw new PopulationValidationError("ไม่พบบ้านในหมู่บ้านนี้");
      const result = await tx.house.updateMany({ where: { id: houseId, villageId }, data: { houseNumber, normalizedHouseNumber, address: input.address?.trim() || null, occupancyStatus, sourceNote: input.sourceNote?.trim() || null } });
      if (result.count !== 1) throw new PopulationValidationError("ไม่สามารถแก้ไขบ้านข้ามหมู่บ้านได้");
      await tx.auditLog.create({ data: { userId: actor.id, villageId, action: AuditAction.UPDATE, resource: "House", resourceId: houseId, metadata: { actorRole: actor.role, actionName: current.occupancyStatus !== occupancyStatus ? "HOUSE_STATUS_CHANGED" : "HOUSE_UPDATED", reason: input.sourceNote?.trim() || null, oldValue: current, newValue: { houseNumber, occupancyStatus, address: input.address?.trim() || null } } } });
      return { statusChanged: current.occupancyStatus !== occupancyStatus };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new PopulationValidationError("เลขที่บ้านนี้มีอยู่แล้วในหมู่บ้าน");
    throw error;
  }
}

export async function createVillagePerson(villageId: string, data: VillagePersonInput, actor: PopulationActor) {
  await assertTargetVillage(villageId);
  const value = normalizePersonInput(data);
  return prisma.$transaction(async (tx) => {
    await assertHouseInVillage(tx, villageId, value.houseId);
    const person = await tx.person.create({ data: { villageId, ...value }, select: { id: true } });
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
    const person = await tx.person.findFirst({ where: { id: personId, villageId }, select: { id: true, houseId: true, status: true } });
    if (!person) throw new PopulationValidationError("ไม่พบบุคคลในหมู่บ้านนี้");
    await assertHouseInVillage(tx, villageId, value.houseId);
    const result = await tx.person.updateMany({ where: { id: personId, villageId }, data: value });
    if (result.count !== 1) throw new PopulationValidationError("ไม่สามารถแก้ไขบุคคลข้ามหมู่บ้านได้");
    if (person.houseId !== value.houseId) {
      if (person.houseId) await tx.personMovement.create({ data: { personId, houseId: person.houseId, movementType: MovementType.MOVE_OUT, date: new Date() } });
      if (value.houseId) await tx.personMovement.create({ data: { personId, houseId: value.houseId, movementType: MovementType.MOVE_IN, date: new Date() } });
    }
    await tx.auditLog.create({ data: { userId: actor.id, villageId, action: AuditAction.UPDATE, resource: "Person", resourceId: personId, metadata: { actorRole: actor.role, actionName: person.houseId !== value.houseId ? "PERSON_MOVED_HOUSE" : "PERSON_UPDATED", previousHouseId: person.houseId, houseId: value.houseId, previousStatus: person.status, status: value.status } } });
    return { moved: person.houseId !== value.houseId };
  });
}

export async function deactivateVillagePerson(villageId: string, personId: string, reason: string, actor: PopulationActor) {
  if (reason.trim().length < 5) throw new PopulationValidationError("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร");
  await prisma.$transaction(async (tx) => {
    const person = await tx.person.findFirst({ where: { id: personId, villageId }, select: { id: true, houseId: true, status: true } });
    if (!person) throw new PopulationValidationError("ไม่พบบุคคลในหมู่บ้านนี้");
    const updated = await tx.person.updateMany({ where: { id: personId, villageId }, data: { status: PersonStatus.MOVED_OUT } });
    if (updated.count !== 1) throw new PopulationValidationError("ไม่สามารถยกเลิกบุคคลข้ามหมู่บ้านได้");
    if (person.houseId && person.status !== PersonStatus.MOVED_OUT) await tx.personMovement.create({ data: { personId, houseId: person.houseId, movementType: MovementType.MOVE_OUT, date: new Date(), note: reason.trim() } });
    await tx.auditLog.create({ data: { userId: actor.id, villageId, action: AuditAction.UPDATE, resource: "Person", resourceId: personId, metadata: { actorRole: actor.role, actionName: "PERSON_MOVED_OUT", reason: reason.trim(), houseId: person.houseId } } });
  });
}
