"use server";

import { AuditAction, MembershipStatus, SystemRole, VillageMembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminActionSession, writeSuperAdminAuditLog } from "@/lib/superadmin";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseSystemRole(value: string): SystemRole {
  return value === "SUPERADMIN" ? SystemRole.SUPERADMIN : SystemRole.USER;
}

function parseVillageRole(value: string): VillageMembershipRole {
  if (value === "HEADMAN") return VillageMembershipRole.HEADMAN;
  if (value === "ASSISTANT_HEADMAN") return VillageMembershipRole.ASSISTANT_HEADMAN;
  return VillageMembershipRole.COMMITTEE;
}

export async function updateUserSystemRoleAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();

  const userId = getString(formData, "userId");
  const role = parseSystemRole(getString(formData, "systemRole"));

  if (!userId) {
    throw new Error("ไม่พบผู้ใช้");
  }

  if (session.id === userId && role !== SystemRole.SUPERADMIN) {
    throw new Error("ไม่สามารถลดสิทธิ์ Super Admin ของบัญชีตัวเองได้");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { systemRole: role },
  });

  await writeSuperAdminAuditLog({
    userId: session.id,
    action: AuditAction.UPDATE,
    resource: "UserSystemRole",
    resourceId: userId,
    metadata: { systemRole: role },
  });

  revalidatePath("/superadmin/users");
  revalidatePath("/superadmin/roles");
}

export async function assignVillageAdminRoleAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();

  const userId = getString(formData, "userId");
  const villageId = getString(formData, "villageId");
  const role = parseVillageRole(getString(formData, "membershipRole"));

  if (!userId || !villageId) {
    throw new Error("ข้อมูลไม่ครบถ้วน");
  }

  await prisma.villageMembership.upsert({
    where: {
      userId_villageId: {
        userId,
        villageId,
      },
    },
    update: {
      role,
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date(),
      houseId: null,
    },
    create: {
      userId,
      villageId,
      role,
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date(),
      houseId: null,
    },
  });

  await writeSuperAdminAuditLog({
    userId: session.id,
    action: AuditAction.APPROVE,
    resource: "VillageAdminRoleAssignment",
    resourceId: `${userId}:${villageId}`,
    metadata: { membershipRole: role },
    villageId,
  });

  revalidatePath("/superadmin/users");
  revalidatePath("/superadmin/roles");
}

export async function removeVillageAdminRoleAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();

  const membershipId = getString(formData, "membershipId");
  if (!membershipId) {
    throw new Error("ไม่พบรายการสมาชิก");
  }

  const membership = await prisma.villageMembership.update({
    where: { id: membershipId },
    data: {
      role: VillageMembershipRole.RESIDENT,
    },
    select: {
      id: true,
      villageId: true,
      userId: true,
    },
  });

  await writeSuperAdminAuditLog({
    userId: session.id,
    action: AuditAction.REJECT,
    resource: "VillageAdminRoleRemoval",
    resourceId: membership.id,
    metadata: { userId: membership.userId },
    villageId: membership.villageId,
  });

  revalidatePath("/superadmin/users");
  revalidatePath("/superadmin/roles");
}

export async function suspendUserMembershipsAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();

  const userId = getString(formData, "userId");
  if (!userId) {
    throw new Error("ไม่พบผู้ใช้");
  }

  await prisma.villageMembership.updateMany({
    where: {
      userId,
      status: MembershipStatus.ACTIVE,
    },
    data: {
      status: MembershipStatus.SUSPENDED,
    },
  });

  await writeSuperAdminAuditLog({
    userId: session.id,
    action: AuditAction.UPDATE,
    resource: "UserMembershipSuspension",
    resourceId: userId,
  });

  revalidatePath("/superadmin/users");
}
