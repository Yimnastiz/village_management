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
import { isValidStrictThaiNationalId, normalizeNationalId } from "@/lib/thai-identity";
import {
  isValidPersonName,
  normalizePersonGender,
  normalizePersonName,
  validateOptionalPersonDate,
} from "@/lib/person-validation";
import { prisma } from "@/lib/prisma";

export type PopulationActor = { id: string | null; role: "ADMIN" | "SUPERADMIN" };
export type VillagePersonInput = {
  firstName: string; lastName: string; nationalId: string; dateOfBirth: string;
  gender: string; phone: string; email: string; status?: string; houseId: string; reason?: string;
};
// occupancyStatus remains required by the current schema, but is deliberately
// not part of the population-management workflow or UI.
export type VillageHouseInput = { houseNumber: string; address?: string; sourceNote?: string };
export type VillageHouseBatchError = { index: number; field: "houseNumber" | "address"; message: string };
export class PopulationBatchValidationError extends Error {
  constructor(public readonly errors: VillageHouseBatchError[]) { super("ข้อมูลบ้านไม่ถูกต้อง"); }
}

export class PopulationValidationError extends Error {}

export async function assertTargetVillage(villageId: string) {
  if (!villageId) throw new PopulationValidationError("ต้องระบุหมู่บ้านเป้าหมาย");
  const village = await prisma.village.findUnique({ where: { id: villageId }, select: { id: true, name: true } });
  if (!village) throw new PopulationValidationError("ไม่พบหมู่บ้านเป้าหมาย");
  return village;
}

export function normalizePersonInput(data: VillagePersonInput) {
  const firstName = normalizePersonName(typeof data.firstName === "string" ? data.firstName : "");
  const lastName = normalizePersonName(typeof data.lastName === "string" ? data.lastName : "");
  if (!firstName || !lastName) throw new PopulationValidationError("กรุณาระบุชื่อและนามสกุล");
  if (!isValidPersonName(firstName)) throw new PopulationValidationError("ชื่อใช้ได้เฉพาะตัวอักษร เว้นวรรค เครื่องหมาย - ' และ .");
  if (!isValidPersonName(lastName)) throw new PopulationValidationError("นามสกุลใช้ได้เฉพาะตัวอักษร เว้นวรรค เครื่องหมาย - ' และ .");
  const parsedDate = validateOptionalPersonDate(typeof data.dateOfBirth === "string" ? data.dateOfBirth : "");
  if (!parsedDate.valid) throw new PopulationValidationError(parsedDate.reason === "FUTURE" ? "วันเกิดต้องไม่เป็นวันในอนาคต" : "วันเกิดไม่ถูกต้อง");
  const gender = normalizePersonGender(typeof data.gender === "string" ? data.gender : "");
  if (!gender) throw new PopulationValidationError("ข้อมูลเพศไม่ถูกต้อง");
  const rawNationalId = typeof data.nationalId === "string" ? data.nationalId.trim() : "";
  const nationalId = rawNationalId ? normalizeNationalId(rawNationalId) : null;
  if (rawNationalId && !isValidStrictThaiNationalId(rawNationalId)) throw new PopulationValidationError("เลขบัตรประชาชนไม่ถูกต้อง");
  const phone = (typeof data.phone === "string" ? data.phone : "").trim().replace(/[\s-]/g, "") || null;
  if (phone && !/^\+?\d{9,15}$/.test(phone)) throw new PopulationValidationError("รูปแบบเบอร์โทรไม่ถูกต้อง");
  const email = (typeof data.email === "string" ? data.email : "").trim().toLocaleLowerCase("en-US") || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PopulationValidationError("อีเมลสำหรับติดต่อไม่ถูกต้อง");
  return { firstName, lastName, nationalId, dateOfBirth: parsedDate.value, gender, phone, email, houseId: (typeof data.houseId === "string" ? data.houseId : "").trim() || null };
}

function comparableValue(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
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

export async function createVillageHouses(villageId: string, inputs: VillageHouseInput[], actor: PopulationActor) {
  await assertTargetVillage(villageId);
  const errors: VillageHouseBatchError[] = [];
  if (!Array.isArray(inputs) || !inputs.length) errors.push({ index: 0, field: "houseNumber", message: "กรุณาระบุบ้านเลขที่" });
  if (inputs.length > 50) errors.push({ index: 0, field: "houseNumber", message: "เพิ่มได้สูงสุด 50 หลังต่อครั้ง" });
  const values = inputs.slice(0, 50).map((input, index) => {
    const houseNumber = typeof input?.houseNumber === "string" ? input.houseNumber.trim() : "";
    const address = typeof input?.address === "string" ? input.address.trim() : "";
    const normalizedHouseNumber = normalizeHouseNumber(houseNumber);
    if (!houseNumber) errors.push({ index, field: "houseNumber", message: "กรุณาระบุบ้านเลขที่" });
    else if (!isValidHouseNumber(normalizedHouseNumber)) errors.push({ index, field: "houseNumber", message: "รูปแบบเลขที่บ้านไม่ถูกต้อง" });
    if (address.length > 300) errors.push({ index, field: "address", message: "ที่อยู่เพิ่มเติมต้องไม่เกิน 300 ตัวอักษร" });
    return { houseNumber, address, normalizedHouseNumber };
  });
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (!value.normalizedHouseNumber || seen.has(value.normalizedHouseNumber)) errors.push({ index, field: "houseNumber", message: "บ้านเลขที่นี้ซ้ำกับรายการด้านบน" });
    else seen.add(value.normalizedHouseNumber);
  });
  if (errors.length) throw new PopulationBatchValidationError(errors);

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.house.findMany({ where: { villageId, normalizedHouseNumber: { in: values.map((value) => value.normalizedHouseNumber) } }, select: { normalizedHouseNumber: true } });
      const existingNumbers = new Set(existing.map((house) => house.normalizedHouseNumber));
      const duplicateErrors = values.flatMap((value, index): VillageHouseBatchError[] => existingNumbers.has(value.normalizedHouseNumber) ? [{ index, field: "houseNumber", message: "บ้านเลขที่นี้มีอยู่ในทะเบียนแล้ว" }] : []);
      if (duplicateErrors.length) throw new PopulationBatchValidationError(duplicateErrors);
      const houses = await Promise.all(values.map((value) => tx.house.create({ data: { villageId, houseNumber: value.houseNumber, normalizedHouseNumber: value.normalizedHouseNumber, address: value.address || null, occupancyStatus: HouseholdOccupancyStatus.OCCUPIED, sourceType: actor.role === "SUPERADMIN" ? HouseSourceType.SUPERADMIN_CREATED : HouseSourceType.ADMIN_CREATED, verifiedByUserId: actor.id, verifiedAt: new Date() }, select: { id: true, houseNumber: true } })));
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          villageId,
          action: AuditAction.CREATE,
          resource: "House",
          resourceId: houses[0]?.id,
          metadata: {
            actorRole: actor.role,
            actorType: actor.role === "SUPERADMIN" ? "SUPERADMIN_ENV" : undefined,
            actionName: "HOUSE_BATCH_CREATED",
            count: houses.length,
            houseIds: houses.map((house) => house.id),
            houseNumbers: houses.map((house) => house.houseNumber),
            newValue: { houseNumbers: houses.map((house) => house.houseNumber).join(", ") },
          },
        },
      });
      return houses;
    });
  } catch (error) {
    if (error instanceof PopulationBatchValidationError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new PopulationBatchValidationError([{ index: 0, field: "houseNumber", message: "มีเลขที่บ้านซ้ำในทะเบียน กรุณาลองใหม่อีกครั้ง" }]);
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
    const person = await tx.person.findFirst({ where: { id: personId, villageId }, select: { id: true, userId: true, houseId: true, status: true, firstName: true, lastName: true, nationalId: true, dateOfBirth: true, gender: true, phone: true, email: true, house: { select: { houseNumber: true } } } });
    if (!person) throw new PopulationValidationError("ไม่พบบุคคลในหมู่บ้านนี้");
    if (person.userId && person.nationalId !== value.nationalId) throw new PopulationValidationError("เลขบัตรประชาชนเชื่อมกับบัญชีผู้ใช้แล้วและแก้ไขจากทะเบียนประชากรไม่ได้");
    if (person.userId && person.phone !== value.phone) throw new PopulationValidationError("เบอร์นี้ใช้สำหรับเข้าสู่ระบบและต้องเปลี่ยนผ่านขั้นตอนบัญชีผู้ใช้");
    if (person.status === PersonStatus.MOVED_OUT && person.houseId !== value.houseId) throw new PopulationValidationError("บุคคลนี้ย้ายออกจากทะเบียนแล้ว หากกลับมาอยู่ใหม่ให้ส่งคำขอผูกเลขบ้านใหม่");
    if (person.status === PersonStatus.DECEASED && person.houseId !== value.houseId) throw new PopulationValidationError("ไม่สามารถเปลี่ยนบ้านของผู้เสียชีวิตจากแบบฟอร์มแก้ไขทั่วไปได้");
    await assertHouseInVillage(tx, villageId, value.houseId);
    if (value.nationalId && await tx.person.findFirst({ where: { villageId, nationalId: value.nationalId, id: { not: personId } }, select: { id: true } })) throw new PopulationValidationError("เลขบัตรประชาชนนี้มีอยู่ในทะเบียนแล้ว");
    const houseChanged = person.houseId !== value.houseId;
    const reason = typeof data.reason === "string" ? data.reason.trim() : "";
    const nameChanged = person.firstName !== value.firstName || person.lastName !== value.lastName;
    const oldGender = normalizePersonGender(person.gender);
    const genderChanged = oldGender !== value.gender;
    const dateOfBirthChanged = comparableValue(person.dateOfBirth) !== comparableValue(value.dateOfBirth);
    const requiresReason = houseChanged || (Boolean(person.userId) && nameChanged) || (Boolean(person.gender) && genderChanged) || (Boolean(person.dateOfBirth) && dateOfBirthChanged);
    if (requiresReason && reason.length < 5) throw new PopulationValidationError("กรุณาระบุเหตุผลการแก้ไขข้อมูลสำคัญอย่างน้อย 5 ตัวอักษร");
    const changedFields = (Object.keys(value) as Array<keyof typeof value>).filter((key) => comparableValue(person[key as keyof typeof person]) !== comparableValue(value[key]));
    const oldValue = Object.fromEntries(changedFields.map((key) => [key, comparableValue(person[key as keyof typeof person]) ?? null]));
    const newValue = Object.fromEntries(changedFields.map((key) => [key, comparableValue(value[key]) ?? null]));
    const newHouse = houseChanged && value.houseId ? await tx.house.findUnique({ where: { id: value.houseId }, select: { houseNumber: true } }) : null;
    const result = await tx.person.updateMany({ where: { id: personId, villageId }, data: value });
    if (result.count !== 1) throw new PopulationValidationError("ไม่สามารถแก้ไขบุคคลข้ามหมู่บ้านได้");
    if (houseChanged) {
      if (person.houseId) await tx.personMovement.create({ data: { personId, houseId: person.houseId, movementType: MovementType.MOVE_OUT, date: new Date(), note: reason } });
      if (value.houseId) await tx.personMovement.create({ data: { personId, houseId: value.houseId, movementType: MovementType.MOVE_IN, date: new Date(), note: reason } });
      if (person.userId) {
        await tx.villageMembership.updateMany({ where: { userId: person.userId, villageId, role: VillageMembershipRole.RESIDENT, status: MembershipStatus.ACTIVE }, data: { houseId: value.houseId } });
      }
    }
    if (person.userId && nameChanged) await tx.user.update({ where: { id: person.userId }, data: { name: `${value.firstName} ${value.lastName}` } });
    if (changedFields.length) await tx.auditLog.create({ data: { userId: actor.id, villageId, action: AuditAction.UPDATE, resource: "Person", resourceId: personId, metadata: { actorRole: actor.role, actionName: houseChanged ? "PERSON_MOVED_HOUSE" : "PERSON_UPDATED", subject: `${value.firstName} ${value.lastName}`, reason: reason || null, changedFields, oldValue: { ...oldValue, ...(houseChanged ? { houseNumber: person.house?.houseNumber ?? null } : {}) }, newValue: { ...newValue, ...(houseChanged ? { houseNumber: newHouse?.houseNumber ?? null } : {}) } } } });
    return { moved: houseChanged };
  });
}

export async function moveOutVillagePerson(villageId: string, personId: string, reason: string, actor: PopulationActor) {
  const normalizedReason = typeof reason === "string" ? reason.trim() : "";
  if (normalizedReason.length < 5) throw new PopulationValidationError("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร");
  await prisma.$transaction(async (tx) => {
    const person = await tx.person.findFirst({ where: { id: personId, villageId }, select: { id: true, userId: true, houseId: true, status: true } });
    if (!person) throw new PopulationValidationError("ไม่พบบุคคลในหมู่บ้านนี้");
    if (person.status !== PersonStatus.ACTIVE && person.status !== PersonStatus.UNKNOWN) throw new PopulationValidationError("สถานะปัจจุบันไม่สามารถบันทึกการย้ายออกได้");
    const linkedMembership = person.userId ? await tx.villageMembership.findUnique({ where: { userId_villageId: { userId: person.userId, villageId } }, select: { role: true, status: true, houseId: true } }) : null;
    if (linkedMembership && linkedMembership.role !== VillageMembershipRole.RESIDENT) throw new PopulationValidationError("บัญชีผู้ใช้นี้มีบทบาทผู้ดูแลหมู่บ้าน จึงไม่สามารถย้ายออกผ่านรายการประชากรได้");
    const updated = await tx.person.updateMany({ where: { id: personId, villageId, status: person.status }, data: { status: PersonStatus.MOVED_OUT, houseId: null } });
    if (updated.count !== 1) throw new PopulationValidationError("ไม่สามารถยกเลิกบุคคลข้ามหมู่บ้านได้");
    if (person.houseId) await tx.personMovement.create({ data: { personId, houseId: person.houseId, movementType: MovementType.MOVE_OUT, date: new Date(), note: normalizedReason } });
    if (person.userId && linkedMembership?.role === VillageMembershipRole.RESIDENT) {
      await tx.villageMembership.updateMany({ where: { userId: person.userId, villageId, role: VillageMembershipRole.RESIDENT }, data: { status: MembershipStatus.SUSPENDED, houseId: null, joinedAt: null } });
      await tx.authSession.updateMany({ where: { userId: person.userId, activeVillageId: villageId, expiresAt: { gt: new Date() } }, data: { activeVillageId: null } });
      await tx.notification.create({ data: { userId: person.userId, villageId, type: NotificationType.SYSTEM, title: "สถานะทะเบียนของคุณมีการเปลี่ยนแปลง", body: "คุณถูกย้ายออกจากทะเบียนบ้านของหมู่บ้านนี้ หากต้องการกลับมาใช้งานในฐานะลูกบ้าน กรุณาส่งคำขอผูกเลขบ้านใหม่", metadata: { actionUrl: "/resident/binding", actionLabel: "ส่งคำขอผูกเลขบ้านใหม่", personId } } });
    }
    await tx.auditLog.create({ data: { userId: actor.id, villageId, action: AuditAction.UPDATE, resource: "Person", resourceId: personId, metadata: { actorRole: actor.role, actionName: "PERSON_MOVED_OUT", reason: normalizedReason, changedFields: ["status", "houseId"], oldValue: { status: person.status, houseId: person.houseId }, newValue: { status: PersonStatus.MOVED_OUT, houseId: null }, previousMembershipStatus: linkedMembership?.status ?? null, newMembershipStatus: linkedMembership?.role === VillageMembershipRole.RESIDENT ? MembershipStatus.SUSPENDED : null } } });
  });
}

export async function markVillagePersonDeceased(villageId: string, personId: string, date: string, reason: string, actor: PopulationActor) {
  const normalizedDate = typeof date === "string" ? date.trim() : "";
  const normalizedReason = typeof reason === "string" ? reason.trim() : "";
  const parsedDate = validateOptionalPersonDate(normalizedDate);
  if (!normalizedDate || !parsedDate.valid || !parsedDate.value) throw new PopulationValidationError(!parsedDate.valid && parsedDate.reason === "FUTURE" ? "วันที่เสียชีวิตต้องไม่เป็นวันในอนาคต" : "วันที่เสียชีวิตไม่ถูกต้อง");
  const deceasedAt = parsedDate.value;
  if (normalizedReason.length < 5) throw new PopulationValidationError("กรุณาระบุเหตุผลหรือหมายเหตุอย่างน้อย 5 ตัวอักษร");
  await prisma.$transaction(async (tx) => {
    const person = await tx.person.findFirst({ where: { id: personId, villageId }, select: { id: true, userId: true, houseId: true, status: true, firstName: true, lastName: true, dateOfBirth: true } });
    if (!person) throw new PopulationValidationError("ไม่พบบุคคลในหมู่บ้านนี้");
    if (person.status !== PersonStatus.ACTIVE && person.status !== PersonStatus.UNKNOWN) throw new PopulationValidationError("สถานะปัจจุบันไม่สามารถบันทึกการเสียชีวิตได้");
    if (person.dateOfBirth && deceasedAt < person.dateOfBirth) throw new PopulationValidationError("วันที่เสียชีวิตต้องไม่ก่อนวันเกิด");
    const linkedMembership = person.userId ? await tx.villageMembership.findUnique({ where: { userId_villageId: { userId: person.userId, villageId } }, select: { role: true, status: true, houseId: true } }) : null;
    if (linkedMembership && linkedMembership.role !== VillageMembershipRole.RESIDENT) throw new PopulationValidationError("บัญชีนี้ยังมีบทบาทผู้ดูแลหมู่บ้าน กรุณาปรับสิทธิ์บัญชีก่อนบันทึกการเสียชีวิต");
    const updated = await tx.person.updateMany({ where: { id: personId, villageId, status: person.status }, data: { status: PersonStatus.DECEASED } });
    if (updated.count !== 1) throw new PopulationValidationError("สถานะบุคคลถูกเปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่");
    await tx.personMovement.create({ data: { personId, houseId: person.houseId, movementType: MovementType.DEATH, date: deceasedAt, note: normalizedReason } });
    if (person.userId && linkedMembership?.role === VillageMembershipRole.RESIDENT) {
      await tx.villageMembership.updateMany({ where: { userId: person.userId, villageId, role: VillageMembershipRole.RESIDENT }, data: { status: MembershipStatus.SUSPENDED, houseId: null, joinedAt: null } });
      await tx.authSession.updateMany({ where: { userId: person.userId, activeVillageId: villageId, expiresAt: { gt: new Date() } }, data: { activeVillageId: null } });
    }
    await tx.auditLog.create({ data: { userId: actor.id, villageId, action: AuditAction.UPDATE, resource: "Person", resourceId: personId, metadata: { actorRole: actor.role, actionName: "PERSON_MARKED_DECEASED", subject: `${person.firstName} ${person.lastName}`, reason: normalizedReason, changedFields: ["status", "dateOfDeath"], oldValue: { status: person.status, dateOfDeath: null }, newValue: { status: PersonStatus.DECEASED, dateOfDeath: normalizedDate }, previousMembershipStatus: linkedMembership?.status ?? null, newMembershipStatus: linkedMembership?.role === VillageMembershipRole.RESIDENT ? MembershipStatus.SUSPENDED : null } } });
  });
}
