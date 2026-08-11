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

async function cleanupImportedHouses(villageId: string, houseIds: string[], jobCreatedAt: Date, tx: Prisma.TransactionClient) {
  if (houseIds.length === 0) return;

  for (const houseId of houseIds) {
    const [peopleCount, memberCount] = await Promise.all([
      tx.person.count({ where: { houseId } }),
      tx.villageMembership.count({ where: { houseId } }),
    ]);

    if (peopleCount === 0 && memberCount === 0) {
      await tx.house.deleteMany({ where: { id: houseId, villageId, sourceType: "IMPORT", createdAt: { gte: jobCreatedAt } } });
    }
  }
}

export async function deleteImportJobDatasetAction(formData: FormData) {
  const jobIdValue = formData.get("jobId");
  if (typeof jobIdValue !== "string" || !jobIdValue.trim()) {
    throw new Error("ไม่พบรหัสงานนำเข้า");
  }

  const jobId = jobIdValue.trim();
  const reason = typeof formData.get("supportReason") === "string" ? formData.get("supportReason")!.toString().trim() : "";
  if (reason.length < 5) throw new Error("กรุณาระบุเหตุผลการ rollback อย่างน้อย 5 ตัวอักษร");
  const { villageId, createdAt, payload } = await requireImportJobForAdmin(jobId);

  const personIds = payload.createdPersonIds ?? [];
  const houseIds = payload.createdHouseIds ?? [];

  await prisma.$transaction(async (tx) => {
    if (personIds.length > 0) await tx.person.deleteMany({ where: { id: { in: personIds }, villageId, createdAt: { gte: createdAt } } });
    await cleanupImportedHouses(villageId, houseIds, createdAt, tx);
    await tx.auditLog.create({ data: { userId: (await getSessionContextFromServerCookies())!.id, villageId, action: AuditAction.POPULATION_IMPORT_ROLLBACK, resource: "PopulationImportJob", resourceId: jobId, metadata: { actorRole: "ADMIN", jobId, reason, createdPersonCount: personIds.length, createdHouseCount: houseIds.length } } });
  });

  revalidatePath("/admin/population/import");
  revalidatePath(`/admin/population/import/${jobId}`);
  revalidatePath("/admin/population/houses");
  revalidatePath("/admin/population/people");
}

export async function deleteImportedPersonAction(formData: FormData) {
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
    if (person.houseId && houseIds.includes(person.houseId)) await cleanupImportedHouses(villageId, [person.houseId], new Date(0), tx);
    await tx.auditLog.create({ data: { userId: (await getSessionContextFromServerCookies())!.id, villageId, action: AuditAction.POPULATION_IMPORT_ROLLBACK, resource: "PopulationImportJob", resourceId: jobId, metadata: { actorRole: "ADMIN", reason: "ลบบุคคลที่สร้างจาก import job", personId } } });
  });

  revalidatePath(`/admin/population/import/${jobId}`);
  revalidatePath("/admin/population/import");
  revalidatePath("/admin/population/houses");
  revalidatePath("/admin/population/people");
}
