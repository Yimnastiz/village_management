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

export async function updateUserProfileAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();

  const userId = getString(formData, "userId");
  if (!userId) {
    throw new Error("ไม่พบผู้ใช้");
  }

  const name = getString(formData, "name");
  const phoneNumber = getString(formData, "phoneNumber");
  const email = getString(formData, "email") || null;
  const image = getString(formData, "image") || null;
  const registrationProvince = getString(formData, "registrationProvince") || null;
  const registrationDistrict = getString(formData, "registrationDistrict") || null;
  const registrationSubdistrict = getString(formData, "registrationSubdistrict") || null;

  if (!name || !phoneNumber) {
    throw new Error("กรุณากรอกชื่อและเบอร์โทรศัพท์");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      phoneNumber,
      email,
      image,
      registrationProvince,
      registrationDistrict,
      registrationSubdistrict,
    },
  });

  await writeSuperAdminAuditLog({
    userId: session.id,
    action: AuditAction.UPDATE,
    resource: "UserProfile",
    resourceId: userId,
  });

  revalidatePath("/superadmin/users");
  revalidatePath(`/superadmin/users/${userId}`);
}

export async function createUserMembershipAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();

  const userId = getString(formData, "userId");
  const villageId = getString(formData, "villageId");
  const roleInput = getString(formData, "role");
  const statusInput = getString(formData, "status");
  const houseId = getString(formData, "houseId") || null;

  if (!userId || !villageId || !roleInput || !statusInput) {
    throw new Error("ข้อมูลสมาชิกไม่ครบถ้วน");
  }

  const role = roleInput as VillageMembershipRole;
  const status = statusInput as MembershipStatus;

  const membership = await prisma.villageMembership.upsert({
    where: { userId_villageId: { userId, villageId } },
    update: {
      role,
      status,
      houseId,
      joinedAt: status === MembershipStatus.ACTIVE ? new Date() : null,
    },
    create: {
      userId,
      villageId,
      role,
      status,
      houseId,
      joinedAt: status === MembershipStatus.ACTIVE ? new Date() : null,
    },
  });

  await writeSuperAdminAuditLog({
    userId: session.id,
    action: AuditAction.UPDATE,
    resource: "UserMembership",
    resourceId: membership.id,
    metadata: { role, status, villageId },
    villageId,
  });

  revalidatePath("/superadmin/users");
  revalidatePath(`/superadmin/users/${userId}`);
}

export async function updateUserMembershipAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();

  const membershipId = getString(formData, "membershipId");
  const userId = getString(formData, "userId");
  if (!membershipId || !userId) {
    throw new Error("ไม่พบรายการสมาชิก");
  }

  const role = getString(formData, "role") as VillageMembershipRole;
  const status = getString(formData, "status") as MembershipStatus;
  const houseId = getString(formData, "houseId") || null;

  const updated = await prisma.villageMembership.update({
    where: { id: membershipId },
    data: {
      role,
      status,
      houseId,
      joinedAt: status === MembershipStatus.ACTIVE ? new Date() : null,
    },
    select: { id: true, villageId: true },
  });

  await writeSuperAdminAuditLog({
    userId: session.id,
    action: AuditAction.UPDATE,
    resource: "UserMembership",
    resourceId: updated.id,
    metadata: { role, status },
    villageId: updated.villageId,
  });

  revalidatePath("/superadmin/users");
  revalidatePath(`/superadmin/users/${userId}`);
}

export async function deleteUserMembershipAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();

  const membershipId = getString(formData, "membershipId");
  const userId = getString(formData, "userId");
  if (!membershipId || !userId) {
    throw new Error("ไม่พบรายการสมาชิก");
  }

  const deleted = await prisma.villageMembership.delete({
    where: { id: membershipId },
    select: { id: true, villageId: true },
  });

  await writeSuperAdminAuditLog({
    userId: session.id,
    action: AuditAction.DELETE,
    resource: "UserMembership",
    resourceId: deleted.id,
    villageId: deleted.villageId,
  });

  revalidatePath("/superadmin/users");
  revalidatePath(`/superadmin/users/${userId}`);
}

export async function deleteUserAccountAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();

  const userId = getString(formData, "userId");
  if (!userId) {
    throw new Error("ไม่พบผู้ใช้");
  }

  if (session.id === userId) {
    throw new Error("ไม่สามารถลบบัญชีของตนเองได้");
  }

  const deleted = await prisma.user.delete({
    where: { id: userId },
    select: { id: true, name: true },
  });

  await writeSuperAdminAuditLog({
    userId: session.id,
    action: AuditAction.DELETE,
    resource: "UserAccount",
    resourceId: deleted.id,
    metadata: { name: deleted.name },
  });

  revalidatePath("/superadmin/users");
}
