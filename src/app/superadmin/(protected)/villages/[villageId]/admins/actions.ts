"use server";

import { AuditAction, MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminActionSession } from "@/lib/superadmin";
import { notifyVillageAdministrationOfSuperAdminIntervention } from "@/lib/superadmin-village-intervention";

const ADMIN_ROLES = [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN] as const;
const value = (data: FormData, key: string) => typeof data.get(key) === "string" ? String(data.get(key)).trim() : "";

function requireReason(data: FormData) {
  const reason = value(data, "reason");
  if (reason.length < 5 || reason.length > 500) throw new Error("เหตุผลต้องมีความยาว 5–500 ตัวอักษร");
  return reason;
}

async function requireVillage(villageId: string) {
  const village = await prisma.village.findUnique({ where: { id: villageId }, select: { id: true, name: true } });
  if (!village) throw new Error("ไม่พบหมู่บ้านเป้าหมาย");
  return village;
}

function parseAdminRole(role: string) {
  if (role === VillageMembershipRole.HEADMAN || role === VillageMembershipRole.ASSISTANT_HEADMAN) return role;
  throw new Error("บทบาทผู้ดูแลไม่ถูกต้อง");
}

export async function appointVillageAdministratorAction(villageId: string, data: FormData) {
  const actor = await requireSuperAdminActionSession();
  const userId = value(data, "userId");
  const role = parseAdminRole(value(data, "role"));
  const reason = requireReason(data);
  const confirmReplacement = value(data, "confirmReplacement") === "true";
  await requireVillage(villageId);
  if (!userId) throw new Error("กรุณาเลือกผู้ใช้ที่ต้องการแต่งตั้ง");

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: userId, accountStatus: "ACTIVE", systemRole: { not: "SUPERADMIN" }, OR: [{ memberships: { some: { villageId } } }, { registrationVillageId: villageId }] },
      select: { id: true, name: true, phoneNumber: true },
    });
    if (!user) throw new Error("บัญชีนี้ไม่มีสิทธิ์ได้รับการแต่งตั้งในหมู่บ้านนี้");
    const previous = await tx.villageMembership.findUnique({ where: { userId_villageId: { userId, villageId } }, select: { id: true, role: true, status: true } });
    const activeHeadmen = role === VillageMembershipRole.HEADMAN ? await tx.villageMembership.findMany({ where: { villageId, role: VillageMembershipRole.HEADMAN, status: MembershipStatus.ACTIVE, userId: { not: userId } }, select: { id: true, userId: true } }) : [];
    if (activeHeadmen.length && !confirmReplacement) throw new Error("หมู่บ้านนี้มีผู้ใหญ่บ้านที่ใช้งานอยู่ กรุณายืนยันการแทนที่ก่อนดำเนินการ");
    if (activeHeadmen.length) await tx.villageMembership.updateMany({ where: { id: { in: activeHeadmen.map((item) => item.id) } }, data: { status: MembershipStatus.SUSPENDED } });
    const membership = await tx.villageMembership.upsert({
      where: { userId_villageId: { userId, villageId } },
      update: { role, status: MembershipStatus.ACTIVE, houseId: null, joinedAt: new Date() },
      create: { userId, villageId, role, status: MembershipStatus.ACTIVE, joinedAt: new Date() },
    });
    await tx.auditLog.create({ data: { userId: actor.id, villageId, action: AuditAction.APPROVE, resource: "VillageAdministrator", resourceId: membership.id, metadata: { actorRole: "SUPERADMIN", supportReason: reason, targetUserId: user.id, targetName: user.name, oldValue: previous ? { role: previous.role, status: previous.status } : null, newValue: { role, status: MembershipStatus.ACTIVE }, replacedHeadmanMembershipIds: activeHeadmen.map((item) => item.id) } } });
    await notifyVillageAdministrationOfSuperAdminIntervention(tx, { villageId, actionLabel: role === VillageMembershipRole.HEADMAN ? "แต่งตั้งผู้ใหญ่บ้าน" : "แต่งตั้งผู้ช่วยผู้ใหญ่บ้าน", supportReason: reason, targetType: "VillageMembership", targetId: membership.id, targetName: user.name, actionUrl: "/admin", additionalRecipientUserIds: [user.id, ...activeHeadmen.map((item) => item.userId)], metadata: { membershipId: membership.id, role } });
  });
  revalidatePath(`/superadmin/villages/${villageId}/admins`);
  revalidatePath(`/superadmin/villages/${villageId}/users`);
  return { message: "แต่งตั้งผู้ดูแลหมู่บ้านเรียบร้อยแล้ว" };
}

export async function updateVillageAdministratorAction(villageId: string, data: FormData) {
  const actor = await requireSuperAdminActionSession();
  const membershipId = value(data, "membershipId");
  const operation = value(data, "operation");
  const reason = requireReason(data);
  const requestedRole = operation === "CHANGE_ROLE" ? parseAdminRole(value(data, "role")) : null;
  const confirmVacancy = value(data, "confirmVacancy") === "true";
  const confirmReplacement = value(data, "confirmReplacement") === "true";
  await requireVillage(villageId);
  if (!membershipId || !["SUSPEND", "ACTIVATE", "CHANGE_ROLE"].includes(operation)) throw new Error("รายการดำเนินการไม่ถูกต้อง");

  await prisma.$transaction(async (tx) => {
    const membership = await tx.villageMembership.findFirst({ where: { id: membershipId, villageId, role: { in: ADMIN_ROLES } }, select: { id: true, userId: true, role: true, status: true, user: { select: { name: true } } } });
    if (!membership) throw new Error("ไม่พบผู้ดูแลในหมู่บ้านเป้าหมาย");
    if (operation === "ACTIVATE" && membership.status !== MembershipStatus.SUSPENDED) throw new Error("เปิดใช้งานได้เฉพาะผู้ดูแลที่ถูกระงับ");
    if (operation !== "ACTIVATE" && membership.status !== MembershipStatus.ACTIVE) throw new Error("ผู้ดูแลรายนี้ไม่พร้อมสำหรับการดำเนินการที่เลือก");
    if (operation === "CHANGE_ROLE" && requestedRole === membership.role) throw new Error("กรุณาเลือกบทบาทใหม่ที่แตกต่างจากเดิม");
    const vacatesHeadman = membership.role === VillageMembershipRole.HEADMAN && (operation === "SUSPEND" || (operation === "CHANGE_ROLE" && requestedRole !== VillageMembershipRole.HEADMAN));
    if (vacatesHeadman && !confirmVacancy) throw new Error("กรุณายืนยันการเว้นว่างตำแหน่งผู้ใหญ่บ้าน");
    const activeHeadmen = requestedRole === VillageMembershipRole.HEADMAN ? await tx.villageMembership.findMany({ where: { villageId, role: VillageMembershipRole.HEADMAN, status: MembershipStatus.ACTIVE, id: { not: membership.id } }, select: { id: true, userId: true } }) : [];
    if (activeHeadmen.length && !confirmReplacement) throw new Error("หมู่บ้านนี้มีผู้ใหญ่บ้านที่ใช้งานอยู่ กรุณายืนยันการแทนที่ก่อนดำเนินการ");
    if (activeHeadmen.length) await tx.villageMembership.updateMany({ where: { id: { in: activeHeadmen.map((item) => item.id) } }, data: { status: MembershipStatus.SUSPENDED } });
    const nextRole = requestedRole ?? membership.role;
    const nextStatus = operation === "SUSPEND" ? MembershipStatus.SUSPENDED : MembershipStatus.ACTIVE;
    await tx.villageMembership.update({ where: { id: membership.id }, data: { role: nextRole, status: nextStatus } });
    await tx.auditLog.create({ data: { userId: actor.id, villageId, action: AuditAction.UPDATE, resource: "VillageAdministrator", resourceId: membership.id, metadata: { actorRole: "SUPERADMIN", supportReason: reason, targetUserId: membership.userId, targetName: membership.user.name, operation, oldValue: { role: membership.role, status: membership.status }, newValue: { role: nextRole, status: nextStatus }, replacedHeadmanMembershipIds: activeHeadmen.map((item) => item.id) } } });
    await notifyVillageAdministrationOfSuperAdminIntervention(tx, { villageId, actionLabel: operation === "SUSPEND" ? "ระงับผู้ดูแลหมู่บ้าน" : operation === "ACTIVATE" ? "เปิดใช้งานผู้ดูแลหมู่บ้าน" : "เปลี่ยนบทบาทผู้ดูแลหมู่บ้าน", supportReason: reason, targetType: "VillageMembership", targetId: membership.id, targetName: membership.user.name, actionUrl: "/admin", additionalRecipientUserIds: [membership.userId, ...activeHeadmen.map((item) => item.userId)], metadata: { membershipId: membership.id, operation, role: nextRole, status: nextStatus } });
  });
  revalidatePath(`/superadmin/villages/${villageId}/admins`);
  revalidatePath(`/superadmin/villages/${villageId}/users`);
  return { message: "อัปเดตผู้ดูแลหมู่บ้านเรียบร้อยแล้ว" };
}
