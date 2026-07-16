"use server";

import { AuditAction, SystemRole, VillageMembershipRole } from "@prisma/client";
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
  const reason = getString(formData, "reason");

  if (!userId) {
    throw new Error("ไม่พบผู้ใช้");
  }
  if (reason.length < 5) throw new Error("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร");

  if (session.id === userId && role !== SystemRole.SUPERADMIN) {
    throw new Error("ไม่สามารถลดสิทธิ์ Super Admin ของบัญชีตัวเองได้");
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('active-superadmin-role-change'))`;
    const target = await tx.user.findUnique({ where: { id: userId }, select: { systemRole: true, accountStatus: true } });
    if (!target) throw new Error("ไม่พบผู้ใช้");
    if (target.systemRole === SystemRole.SUPERADMIN && role !== SystemRole.SUPERADMIN) {
      const activeCount = await tx.user.count({ where: { systemRole: SystemRole.SUPERADMIN, accountStatus: "ACTIVE" } });
      if (activeCount <= 1) throw new Error("ไม่สามารถดำเนินการได้ เนื่องจากบัญชีนี้เป็น Super Admin คนสุดท้ายของระบบ");
    }
    await tx.user.update({ where: { id: userId }, data: { systemRole: role } });
  });

  await writeSuperAdminAuditLog({
    userId: session.id,
    action: AuditAction.UPDATE,
    resource: "UserSystemRole",
    resourceId: userId,
    metadata: { actorRole: "SUPERADMIN", systemRole: role, reason },
  });

  revalidatePath("/superadmin/users");
  revalidatePath("/superadmin/roles");
}

export async function assignVillageAdminRoleAction(formData: FormData) {
  await requireSuperAdminActionSession();

  const userId = getString(formData, "userId");
  const villageId = getString(formData, "villageId");
  const role = parseVillageRole(getString(formData, "membershipRole"));

  if (!userId || !villageId) {
    throw new Error("ข้อมูลไม่ครบถ้วน");
  }

  void role;
  throw new Error(`กรุณาแต่งตั้งผู้ดูแลผ่าน Village Context /superadmin/villages/${villageId} เพื่อระบุเหตุผลและบันทึก Audit Log`);
}

export async function removeVillageAdminRoleAction(formData: FormData) {
  await requireSuperAdminActionSession();

  const membershipId = getString(formData, "membershipId");
  if (!membershipId) {
    throw new Error("ไม่พบรายการสมาชิก");
  }

  const membership = await prisma.villageMembership.findUnique({ where: { id: membershipId }, select: { villageId: true } });
  if (!membership) throw new Error("ไม่พบ Membership");
  throw new Error(`กรุณาถอดบทบาทผ่าน Village Context /superadmin/villages/${membership.villageId} ระบบจะไม่เปลี่ยนเป็น Resident โดยไม่มีบ้าน`);
}

export async function suspendUserMembershipsAction(formData: FormData) {
  await requireSuperAdminActionSession();

  const userId = getString(formData, "userId");
  if (!userId) {
    throw new Error("ไม่พบผู้ใช้");
  }

  throw new Error("กรุณาระงับ Membership แยกตามหมู่บ้านผ่าน Village Context เพื่อระบุหมู่บ้านเป้าหมายและเหตุผล");
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
  await requireSuperAdminActionSession();

  const userId = getString(formData, "userId");
  const villageId = getString(formData, "villageId");
  if (!userId || !villageId) {
    throw new Error("ข้อมูลสมาชิกไม่ครบถ้วน");
  }

  throw new Error(`กรุณาจัดการ Membership ผ่าน Village Context /superadmin/villages/${villageId}`);
}

export async function updateUserMembershipAction(formData: FormData) {
  await requireSuperAdminActionSession();

  const membershipId = getString(formData, "membershipId");
  const userId = getString(formData, "userId");
  if (!membershipId || !userId) {
    throw new Error("ไม่พบรายการสมาชิก");
  }

  const membership = await prisma.villageMembership.findUnique({ where: { id: membershipId }, select: { villageId: true } });
  if (!membership) throw new Error("ไม่พบ Membership");
  throw new Error(`กรุณาจัดการ Membership ผ่าน Village Context /superadmin/villages/${membership.villageId}`);
}

export async function deleteUserMembershipAction(formData: FormData) {
  await requireSuperAdminActionSession();

  const membershipId = getString(formData, "membershipId");
  const userId = getString(formData, "userId");
  if (!membershipId || !userId) {
    throw new Error("ไม่พบรายการสมาชิก");
  }

  const membership = await prisma.villageMembership.findUnique({ where: { id: membershipId }, select: { villageId: true } });
  if (!membership) throw new Error("ไม่พบ Membership");
  throw new Error(`กรุณาระงับ Membership ผ่าน Village Context /superadmin/villages/${membership.villageId}`);
}

export async function deleteUserAccountAction(formData: FormData) {
  await requireSuperAdminActionSession();

  const userId = getString(formData, "userId");
  if (!userId) {
    throw new Error("ไม่พบผู้ใช้");
  }

  throw new Error("ปิดใช้งาน Hard Delete แล้ว กรุณาใช้ Account Deletion/Anonymization Flow เพื่อรักษาประวัติและข้อมูลทะเบียน");
}
