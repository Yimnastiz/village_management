"use server";

import { MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

type ImportJobDetailsPayload = {
  importedPersonIds?: string[];
  importedHouseIds?: string[];
  importedUserIds?: string[];
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

async function requireImportJobForAdmin(jobId: string) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id || !isAdminUser(session)) {
    throw new Error("ไม่มีสิทธิ์ใช้งาน");
  }

  const adminMembership = session.memberships.find(
    (membership) =>
      membership.status === MembershipStatus.ACTIVE &&
      ADMIN_MEMBERSHIP_ROLES.has(membership.role),
  );
  if (!adminMembership) {
    throw new Error("ไม่พบหมู่บ้านที่คุณมีสิทธิ์จัดการ");
  }

  const job = await prisma.populationImportJob.findFirst({
    where: {
      id: jobId,
      villageId: adminMembership.villageId,
    },
    select: {
      id: true,
      villageId: true,
      startedAt: true,
      errors: true,
    },
  });

  if (!job) {
    throw new Error("ไม่พบงานนำเข้า");
  }

  return {
    villageId: job.villageId,
    startedAt: job.startedAt,
    payload: parsePayload(job.errors),
  };
}

async function cleanupImportedHouses(villageId: string, houseIds: string[]) {
  if (houseIds.length === 0) return;

  for (const houseId of houseIds) {
    const [peopleCount, memberCount] = await Promise.all([
      prisma.person.count({ where: { houseId } }),
      prisma.villageMembership.count({ where: { houseId } }),
    ]);

    if (peopleCount === 0 && memberCount === 0) {
      await prisma.house.deleteMany({ where: { id: houseId, villageId } });
    }
  }
}

export async function deleteImportJobDatasetAction(formData: FormData) {
  const jobIdValue = formData.get("jobId");
  if (typeof jobIdValue !== "string" || !jobIdValue.trim()) {
    throw new Error("ไม่พบรหัสงานนำเข้า");
  }

  const jobId = jobIdValue.trim();
  const { villageId, startedAt, payload } = await requireImportJobForAdmin(jobId);

  const personIds = payload.importedPersonIds ?? [];
  const houseIds = payload.importedHouseIds ?? [];
  const userIds = payload.importedUserIds ?? [];

  if (personIds.length > 0) {
    await prisma.person.deleteMany({
      where: {
        id: { in: personIds },
        villageId,
      },
    });
  }

  if (userIds.length > 0 && startedAt) {
    await prisma.villageMembership.deleteMany({
      where: {
        villageId,
        userId: { in: userIds },
        role: VillageMembershipRole.RESIDENT,
        createdAt: { gte: startedAt },
      },
    });
  }

  await cleanupImportedHouses(villageId, houseIds);

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

  const personIds = payload.importedPersonIds ?? [];
  const houseIds = payload.importedHouseIds ?? [];
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

  await prisma.person.delete({ where: { id: person.id } });

  if (person.houseId && houseIds.includes(person.houseId)) {
    await cleanupImportedHouses(villageId, [person.houseId]);
  }

  revalidatePath(`/admin/population/import/${jobId}`);
  revalidatePath("/admin/population/import");
  revalidatePath("/admin/population/houses");
  revalidatePath("/admin/population/people");
}
