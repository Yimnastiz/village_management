"use server";

import { AuditAction, MembershipStatus, PopulationImportStage, Prisma, VillageMembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSessionContextFromServerCookies, isAdminUser, isSuperAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { applyStoredImportRow, type StoredImportRow } from "../actions";

type ImportJobDetailsPayload = {
  importedPersonIds?: string[];
  importedHouseIds?: string[];
  importedUserIds?: string[];
  createdPersonIds?: string[];
  createdHouseIds?: string[];
  cleanupHistory?: Array<{ cleanedAt: string; actorId: string; reason: string; deletedPeople: number; deletedHouses: number; skippedCount: number; skippedReasonCounts: Record<string, number> }>;
};

export type ImportCleanupPreflight = {
  deletablePeople: number;
  deletableHouses: number;
  skipped: Array<{ kind: "person" | "house"; label: string; reason: string }>;
  skippedReasonCounts: Record<string, number>;
};

const ADMIN_MEMBERSHIP_ROLES = new Set<VillageMembershipRole>([
  VillageMembershipRole.HEADMAN,
  VillageMembershipRole.ASSISTANT_HEADMAN,
  VillageMembershipRole.COMMITTEE,
]);

function parsePayload(value: unknown): ImportJobDetailsPayload {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as ImportJobDetailsPayload;
  }

  return {};
}

async function requireImportJobForAdmin(jobId: string, targetVillageId = "") {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id || (!isAdminUser(session) && !isSuperAdminUser(session))) {
    throw new Error("ไม่มีสิทธิ์ใช้งาน");
  }

  const adminMembership = session.memberships.find(
    (membership) =>
      membership.status === MembershipStatus.ACTIVE &&
      ADMIN_MEMBERSHIP_ROLES.has(membership.role),
  );
  const villageId = isSuperAdminUser(session) ? targetVillageId : adminMembership?.villageId;
  if (!villageId) {
    throw new Error("ไม่พบหมู่บ้านที่คุณมีสิทธิ์จัดการ");
  }

  const job = await prisma.populationImportJob.findFirst({
    where: {
      id: jobId,
      villageId,
    },
    select: {
      id: true,
      villageId: true,
      startedAt: true,
      createdAt: true,
      stage: true,
      sourceRows: true,
      fileName: true,
      errors: true,
    },
  });

  if (!job) {
    throw new Error("ไม่พบงานนำเข้า");
  }

  return {
    villageId: job.villageId,
    userId: session.id,
    fileName: job.fileName,
    stage: job.stage,
    createdAt: job.createdAt,
    sourceRows: Array.isArray(job.sourceRows) ? job.sourceRows as unknown as StoredImportRow[] : [],
    startedAt: job.startedAt,
    payload: parsePayload(job.errors),
  };
}
export async function confirmPopulationImportAction(formData: FormData) {
  const jobId = typeof formData.get("jobId") === "string" ? formData.get("jobId")!.toString().trim() : "";
  const reason = typeof formData.get("supportReason") === "string" ? formData.get("supportReason")!.toString().trim() : "";
  const targetVillageId = typeof formData.get("targetVillageId") === "string" ? formData.get("targetVillageId")!.toString().trim() : "";
  if (!jobId || reason.length < 5) throw new Error("กรุณาระบุงานและเหตุผลการยืนยันอย่างน้อย 5 ตัวอักษร");
  const access = await requireImportJobForAdmin(jobId, targetVillageId);
  if (access.stage !== PopulationImportStage.PENDING) throw new Error("งานนี้ถูกยืนยันหรือดำเนินการไปแล้ว");
  const claimed = await prisma.populationImportJob.updateMany({ where: { id: jobId, villageId: access.villageId, stage: PopulationImportStage.PENDING }, data: { stage: PopulationImportStage.PROCESSING, confirmedBy: access.userId, confirmedAt: new Date(), supportReason: reason } });
  if (claimed.count !== 1) throw new Error("งานนี้ถูกยืนยันไปแล้ว กรุณารีเฟรชหน้า");
  let importedRows = 0;
  let failedRows = 0;
  const createdPersonIds: string[] = [];
  const createdHouseIds: string[] = [];
  await prisma.$transaction(async (tx) => {
    const ctx: Parameters<typeof applyStoredImportRow>[1] = { userId: access.userId, villageId: access.villageId, villageName: "", province: null, district: null, subdistrict: null };
    const village = await tx.village.findUnique({ where: { id: access.villageId }, select: { name: true, province: true, district: true, subdistrict: true } });
    if (!village) throw new Error("ไม่พบหมู่บ้านของงาน");
    ctx.villageName = village.name; ctx.province = village.province; ctx.district = village.district; ctx.subdistrict = village.subdistrict;
    for (const row of access.sourceRows) {
      if (row.action === "CONFLICT" || row.action === "FAILED") { failedRows += 1; continue; }
      const result = await applyStoredImportRow(tx, ctx, row);
      if (row.action === "CREATE") {
        if (result.personId) createdPersonIds.push(result.personId);
        createdHouseIds.push(result.houseId);
      }
      importedRows += 1;
    }
    const stage = failedRows > 0 ? PopulationImportStage.PARTIAL : PopulationImportStage.COMPLETED;
    await tx.populationImportJob.update({ where: { id: jobId }, data: { stage, importedRows, failedRows, completedAt: new Date(), errors: { ...access.payload, createdPersonIds, createdHouseIds } } });
    const actorRole = targetVillageId ? "SUPERADMIN" : "ADMIN";
    await tx.auditLog.create({ data: { userId: access.userId, villageId: access.villageId, action: AuditAction.POPULATION_IMPORT_CONFIRMED, resource: "PopulationImportJob", resourceId: jobId, metadata: { actorRole, jobId, fileName: access.fileName, supportReason: reason } } });
    await tx.auditLog.create({ data: { userId: access.userId, villageId: access.villageId, action: stage === PopulationImportStage.COMPLETED ? AuditAction.POPULATION_IMPORT_COMPLETED : AuditAction.POPULATION_IMPORT_PARTIAL, resource: "PopulationImportJob", resourceId: jobId, metadata: { actorRole, jobId, fileName: access.fileName, totalRows: access.sourceRows.length, importedRows, failedRows, supportReason: reason } } });
  });
  revalidatePath(`/admin/population/import/${jobId}`);
  revalidatePath("/admin/population/import");
  revalidatePath("/admin/population/houses");
  revalidatePath("/admin/population/people");
  if (targetVillageId) {
    revalidatePath(`/superadmin/villages/${targetVillageId}/population/import`);
    revalidatePath(`/superadmin/villages/${targetVillageId}/population/import/${jobId}`);
    revalidatePath(`/superadmin/villages/${targetVillageId}/houses`);
    revalidatePath(`/superadmin/villages/${targetVillageId}/people`);
  }
}

function countSkipReasons(skipped: ImportCleanupPreflight["skipped"]) {
  return skipped.reduce<Record<string, number>>((counts, item) => {
    counts[item.reason] = (counts[item.reason] ?? 0) + 1;
    return counts;
  }, {});
}

async function assessImportCleanup(tx: Prisma.TransactionClient, villageId: string, jobCreatedAt: Date, personIds: string[], houseIds: string[]): Promise<ImportCleanupPreflight & { deletablePersonIds: string[]; deletableHouseIds: string[] }> {
  const skipped: ImportCleanupPreflight["skipped"] = [];
  const people = personIds.length ? await tx.person.findMany({ where: { id: { in: personIds }, villageId }, select: { id: true, userId: true, firstName: true, lastName: true, createdAt: true, _count: { select: { movements: true } } } }) : [];
  const deletablePersonIds: string[] = [];
  for (const person of people) {
    const label = `${person.firstName} ${person.lastName}`;
    if (person.createdAt < jobCreatedAt) skipped.push({ kind: "person", label, reason: "ข้อมูลไม่ได้ถูกสร้างจากงานนี้" });
    else if (person.userId) skipped.push({ kind: "person", label, reason: "เชื่อมกับบัญชีลูกบ้านแล้ว" });
    else if (person._count.movements > 0) skipped.push({ kind: "person", label, reason: "มีประวัติการย้ายเข้า-ออก" });
    else deletablePersonIds.push(person.id);
  }
  const houses = houseIds.length ? await tx.house.findMany({ where: { id: { in: houseIds }, villageId }, select: { id: true, houseNumber: true, sourceType: true, createdAt: true, _count: { select: { memberships: true, bindingRequests: true, correctionRequests: true, movementHistory: true } } } }) : [];
  const deletableHouseIds: string[] = [];
  for (const house of houses) {
    const label = `บ้าน ${house.houseNumber}`;
    if (house.sourceType !== "IMPORT" || house.createdAt < jobCreatedAt) { skipped.push({ kind: "house", label, reason: "ข้อมูลไม่ได้ถูกสร้างจากงานนี้" }); continue; }
    const remainingPeople = await tx.person.count({ where: { houseId: house.id, id: { notIn: deletablePersonIds } } });
    if (remainingPeople > 0) skipped.push({ kind: "house", label, reason: "ยังมีประชากรอยู่" });
    else if (house._count.memberships > 0) skipped.push({ kind: "house", label, reason: "มีข้อมูลสมาชิกหมู่บ้านที่เกี่ยวข้อง" });
    else if (house._count.bindingRequests > 0) skipped.push({ kind: "house", label, reason: "มีข้อมูลการผูกบ้านที่เกี่ยวข้อง" });
    else if (house._count.correctionRequests > 0) skipped.push({ kind: "house", label, reason: "มีคำขอแก้ไขข้อมูลบ้านที่เกี่ยวข้อง" });
    else if (house._count.movementHistory > 0) skipped.push({ kind: "house", label, reason: "มีประวัติการย้ายเข้า-ออกที่เกี่ยวข้อง" });
    else deletableHouseIds.push(house.id);
  }
  return { deletablePeople: deletablePersonIds.length, deletableHouses: deletableHouseIds.length, deletablePersonIds, deletableHouseIds, skipped, skippedReasonCounts: countSkipReasons(skipped) };
}

export async function getImportCleanupPreflightAction(jobId: string): Promise<ImportCleanupPreflight> {
  const access = await requireImportJobForAdmin(jobId);
  if (access.stage !== PopulationImportStage.COMPLETED && access.stage !== PopulationImportStage.PARTIAL) throw new Error("ลบข้อมูลที่สร้างจากงานนี้ได้หลังงานนำเข้าสิ้นสุดแล้วเท่านั้น");
  const assessment = await prisma.$transaction((tx) => assessImportCleanup(tx, access.villageId, access.createdAt, access.payload.createdPersonIds ?? [], access.payload.createdHouseIds ?? []));
  return { deletablePeople: assessment.deletablePeople, deletableHouses: assessment.deletableHouses, skipped: assessment.skipped, skippedReasonCounts: assessment.skippedReasonCounts };
}

export async function deleteImportJobDatasetAction(formData: FormData) {
  const jobIdValue = formData.get("jobId");
  if (typeof jobIdValue !== "string" || !jobIdValue.trim()) {
    throw new Error("ไม่พบรหัสงานนำเข้า");
  }

  const jobId = jobIdValue.trim();
  const reason = typeof formData.get("supportReason") === "string" ? formData.get("supportReason")!.toString().trim() : "";
  if (reason.length < 5) throw new Error("กรุณาระบุเหตุผลการลบข้อมูลอย่างน้อย 5 ตัวอักษร");
  const { villageId, createdAt, payload, stage, userId } = await requireImportJobForAdmin(jobId);
  if (stage !== PopulationImportStage.COMPLETED && stage !== PopulationImportStage.PARTIAL) {
    throw new Error("ลบข้อมูลที่สร้างจากงานนี้ได้หลังงานนำเข้าสิ้นสุดแล้วเท่านั้น");
  }

  const personIds = payload.createdPersonIds ?? [];
  const houseIds = payload.createdHouseIds ?? [];

  const result = await prisma.$transaction(async (tx) => {
    const assessment = await assessImportCleanup(tx, villageId, createdAt, personIds, houseIds);
    let deletedPeople = 0;
    for (const personId of assessment.deletablePersonIds) {
      const current = await tx.person.findFirst({ where: { id: personId, villageId, userId: null, createdAt: { gte: createdAt } }, select: { id: true, _count: { select: { movements: true } } } });
      if (current?.id && current._count.movements === 0) { await tx.person.delete({ where: { id: current.id } }); deletedPeople += 1; }
    }
    const afterPeople = await assessImportCleanup(tx, villageId, createdAt, [], houseIds);
    let deletedHouses = 0;
    for (const houseId of afterPeople.deletableHouseIds) {
      const deleted = await tx.house.deleteMany({ where: { id: houseId, villageId, sourceType: "IMPORT", createdAt: { gte: createdAt }, persons: { none: {} }, memberships: { none: {} }, bindingRequests: { none: {} }, correctionRequests: { none: {} }, movementHistory: { none: {} } } });
      deletedHouses += deleted.count;
    }
    if (deletedPeople === 0 && deletedHouses === 0 && assessment.skipped.length === 0) {
      throw new Error("ไม่พบข้อมูลที่สร้างจากงานนี้ซึ่งสามารถลบได้");
    }
    const finalAssessment = await assessImportCleanup(tx, villageId, createdAt, [], houseIds);
    const skipped = [...assessment.skipped.filter((item) => item.kind === "person"), ...finalAssessment.skipped];
    const skippedReasonCounts = countSkipReasons(skipped);
    const cleanupHistory = [...(payload.cleanupHistory ?? []), { cleanedAt: new Date().toISOString(), actorId: userId, reason, deletedPeople, deletedHouses, skippedCount: skipped.length, skippedReasonCounts }].slice(-10);
    await tx.populationImportJob.update({ where: { id: jobId }, data: { errors: { ...payload, cleanupHistory } } });
    await tx.auditLog.create({ data: { userId, villageId, action: AuditAction.POPULATION_IMPORT_ROLLBACK, resource: "PopulationImportJob", resourceId: jobId, metadata: { actorRole: "ADMIN", jobId, reason, deletedPeople, deletedHouses, skippedCount: skipped.length, skippedReasonCounts } } });
    return { deletedPeople, deletedHouses, skippedCount: skipped.length, skippedReasonCounts };
  });
  revalidatePath("/admin/population/import");
  revalidatePath(`/admin/population/import/${jobId}`);
  revalidatePath("/admin/population/houses");
  revalidatePath("/admin/population/people");
  return result;
}

export async function deleteImportedPersonAction(_formData: FormData) {
  throw new Error("โปรดใช้การลบข้อมูลที่สร้างจากงานนี้ เพื่อให้ระบบตรวจสอบความปลอดภัยครบถ้วน");
}
/*
  const jobIdValue = formData.get("jobId");
  const personIdValue = formData.get("personId");
  if (typeof jobIdValue !== "string" || !jobIdValue.trim()) {
    throw new Error("ไม่พบรหัสงานนำเข้า");
  }
  if (typeof personIdValue !== "string" || !personIdValue.trim()) {
    throw new Error("ไม่พบรหัสบุคคล");
  }

  const jobId = jobIdValue.trim();
  const personId = personIdValue.trim();

  const { villageId, payload } = await requireImportJobForAdmin(jobId);

  const personIds = payload.createdPersonIds ?? [];
  const houseIds = payload.createdHouseIds ?? [];
  if (!personIds.includes(personId)) {
    throw new Error("บุคคลนี้ไม่ได้อยู่ในชุดนำเข้าของงานนี้");
  }

  throw new Error("โปรดใช้การลบข้อมูลที่สร้างจากงานนี้ เพื่อให้ระบบตรวจสอบความปลอดภัยครบถ้วน");

  const person = await prisma.person.findFirst({
    where: {
      id: personId,
      villageId,
    },
    select: { id: true, houseId: true },
  });
  if (!person) {
    throw new Error("ไม่พบบุคคลที่ต้องการลบ");
  }

  await prisma.$transaction(async (tx) => {
    await tx.person.delete({ where: { id: person.id } });
    void houseIds;
    await tx.auditLog.create({ data: { userId: (await getSessionContextFromServerCookies())!.id, villageId, action: AuditAction.POPULATION_IMPORT_ROLLBACK, resource: "PopulationImportJob", resourceId: jobId, metadata: { actorRole: "ADMIN", reason: "ลบบุคคลที่สร้างจาก import job", personId } } });
  });

  revalidatePath(`/admin/population/import/${jobId}`);
  revalidatePath("/admin/population/import");
  revalidatePath("/admin/population/houses");
  revalidatePath("/admin/population/people");
}
*/
