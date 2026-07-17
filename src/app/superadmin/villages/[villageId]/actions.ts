"use server";

import { AuditAction, BindingRequestStatus, MembershipStatus, NotificationType, VillageMembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminActionSession } from "@/lib/superadmin";
import { isValidHouseNumber, normalizeHouseNumber } from "@/lib/house-number";

function value(formData: FormData, key: string) { const entry = formData.get(key); return typeof entry === "string" ? entry.trim() : ""; }
async function requireVillage(targetVillageId: string) {
  if (!targetVillageId) throw new Error("ต้องระบุหมู่บ้านเป้าหมาย");
  const village = await prisma.village.findUnique({ where: { id: targetVillageId }, select: { id: true, name: true } });
  if (!village) throw new Error("ไม่พบหมู่บ้านเป้าหมาย");
  return village;
}
function requireReason(formData: FormData) { const reason = value(formData, "reason"); if (reason.length < 5) throw new Error("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร"); return reason; }

export async function reviewBindingSupportAction(formData: FormData) {
  const actor = await requireSuperAdminActionSession();
  const targetVillageId = value(formData, "targetVillageId"); const requestId = value(formData, "requestId"); const decision = value(formData, "decision"); const reason = requireReason(formData);
  const village = await requireVillage(targetVillageId);
  if (!requestId || !["APPROVE", "REJECT"].includes(decision)) throw new Error("ข้อมูลคำขอไม่ถูกต้อง");
  await prisma.$transaction(async (tx) => {
    const request = await tx.bindingRequest.findFirst({ where: { id: requestId, villageId: targetVillageId, status: BindingRequestStatus.PENDING } });
    if (!request) throw new Error("ไม่พบคำขอในหมู่บ้านเป้าหมายหรือคำขอถูกดำเนินการแล้ว");
    let resolvedHouseId: string | null = null;
    if (decision === "APPROVE") {
      if (!request.houseNumber) throw new Error("คำขอไม่มีบ้านเลขที่");
      const normalizedHouseNumber = request.houseNumber ? normalizeHouseNumber(request.houseNumber) : null;
      if (!request.houseId && (!normalizedHouseNumber || !isValidHouseNumber(normalizedHouseNumber))) throw new Error("เลขบ้านในคำขอไม่ถูกต้อง");
      if (!request.houseId) throw new Error("เลขบ้านนี้ยังไม่อยู่ในทะเบียนบ้านของระบบ ต้องให้ผู้ดูแลสร้างหรือจับคู่บ้านก่อนอนุมัติ");
      const house = await tx.house.findFirst({ where: { id: request.houseId, villageId: targetVillageId } });
      if (!house) throw new Error("บ้านไม่อยู่ในหมู่บ้านเป้าหมาย");
      resolvedHouseId = house.id;
      await tx.villageMembership.upsert({ where: { userId_villageId: { userId: request.userId, villageId: targetVillageId } }, update: { role: VillageMembershipRole.RESIDENT, status: MembershipStatus.ACTIVE, houseId: house.id, joinedAt: new Date() }, create: { userId: request.userId, villageId: targetVillageId, role: VillageMembershipRole.RESIDENT, status: MembershipStatus.ACTIVE, houseId: house.id, joinedAt: new Date() } });
      await tx.user.update({ where: { id: request.userId }, data: { citizenVerifiedAt: new Date(), registrationVillageId: targetVillageId } });
      await tx.authSession.updateMany({ where: { userId: request.userId, expiresAt: { gt: new Date() } }, data: { activeVillageId: targetVillageId } });
    } else {
      await tx.villageMembership.upsert({ where: { userId_villageId: { userId: request.userId, villageId: targetVillageId } }, update: { role: VillageMembershipRole.RESIDENT, status: MembershipStatus.REJECTED, houseId: null, joinedAt: null }, create: { userId: request.userId, villageId: targetVillageId, role: VillageMembershipRole.RESIDENT, status: MembershipStatus.REJECTED } });
    }
    await tx.bindingRequest.update({ where: { id: request.id }, data: { status: decision === "APPROVE" ? BindingRequestStatus.APPROVED : BindingRequestStatus.REJECTED, houseId: decision === "APPROVE" ? resolvedHouseId : null, reviewedBy: actor.id, reviewedAt: new Date(), reviewNote: reason } });
    await tx.notification.create({ data: { userId: request.userId, villageId: targetVillageId, type: NotificationType.BINDING_REQUEST, title: decision === "APPROVE" ? "คำขอผูกบ้านได้รับการอนุมัติ" : "คำขอผูกบ้านถูกปฏิเสธ", body: decision === "APPROVE" ? `คำขอผูกบ้านของคุณใน ${village.name} ได้รับการอนุมัติแล้ว` : `คำขอผูกบ้านถูกปฏิเสธ: ${reason}`, metadata: { bindingRequestId: request.id, action: decision.toLowerCase(), actionUrl: "/resident/binding/pending" } } });
    await tx.auditLog.create({ data: { userId: actor.id, villageId: targetVillageId, action: decision === "APPROVE" ? AuditAction.APPROVE : AuditAction.REJECT, resource: "BindingRequestSupport", resourceId: request.id, metadata: { actorRole: "SUPERADMIN", targetVillageId, reason, oldValue: { status: "PENDING" }, newValue: { status: decision === "APPROVE" ? "APPROVED" : "REJECTED" } } } });
  });
  revalidatePath(`/superadmin/villages/${targetVillageId}`); revalidatePath("/superadmin/data-quality");
}

export async function setVillageAdminSupportAction(formData: FormData) {
  const actor = await requireSuperAdminActionSession();
  const targetVillageId = value(formData, "targetVillageId"); const userId = value(formData, "userId"); const role = value(formData, "role") as VillageMembershipRole; const reason = requireReason(formData);
  await requireVillage(targetVillageId);
  if (role !== VillageMembershipRole.HEADMAN && role !== VillageMembershipRole.ASSISTANT_HEADMAN && role !== VillageMembershipRole.COMMITTEE) throw new Error("บทบาทไม่ถูกต้อง");
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, systemRole: true, accountStatus: true } });
    if (!user || user.systemRole === "SUPERADMIN" || user.accountStatus !== "ACTIVE") throw new Error("ไม่สามารถแต่งตั้งบัญชีนี้ได้");
    if (role === VillageMembershipRole.HEADMAN) await tx.villageMembership.updateMany({ where: { villageId: targetVillageId, role: VillageMembershipRole.HEADMAN, status: MembershipStatus.ACTIVE, userId: { not: userId } }, data: { status: MembershipStatus.SUSPENDED } });
    const membership = await tx.villageMembership.upsert({ where: { userId_villageId: { userId, villageId: targetVillageId } }, update: { role, status: MembershipStatus.ACTIVE, houseId: null, joinedAt: new Date() }, create: { userId, villageId: targetVillageId, role, status: MembershipStatus.ACTIVE, joinedAt: new Date() } });
    await tx.auditLog.create({ data: { userId: actor.id, villageId: targetVillageId, action: AuditAction.APPROVE, resource: "VillageAdminSupport", resourceId: membership.id, metadata: { actorRole: "SUPERADMIN", targetVillageId, reason, newValue: { userId, role } } } });
  });
  revalidatePath(`/superadmin/villages/${targetVillageId}`);
}

export async function changeMembershipSupportAction(formData: FormData) {
  const actor = await requireSuperAdminActionSession();
  const targetVillageId = value(formData, "targetVillageId"); const membershipId = value(formData, "membershipId"); const operation = value(formData, "operation"); const houseId = value(formData, "houseId") || null; const reason = requireReason(formData);
  await requireVillage(targetVillageId);
  await prisma.$transaction(async (tx) => {
    const membership = await tx.villageMembership.findFirst({ where: { id: membershipId, villageId: targetVillageId } });
    if (!membership) throw new Error("Membership ไม่อยู่ในหมู่บ้านเป้าหมาย");
    if (membership.role === VillageMembershipRole.HEADMAN && operation === "SUSPEND" && value(formData, "confirmVacant") !== "true") throw new Error("การระงับ Headman ต้องยืนยันว่าหมู่บ้านจะอยู่ในสถานะยังไม่มีผู้ใหญ่บ้าน หรือแต่งตั้งผู้ใหม่ก่อน");
    if (operation === "RESIDENT") {
      if (!houseId || !await tx.house.findFirst({ where: { id: houseId, villageId: targetVillageId } })) throw new Error("ต้องเลือกบ้านที่อยู่ในหมู่บ้านนี้ก่อนเปลี่ยนเป็น Resident");
      await tx.villageMembership.update({ where: { id: membership.id }, data: { role: VillageMembershipRole.RESIDENT, status: MembershipStatus.ACTIVE, houseId } });
    } else if (operation === "ACTIVATE") await tx.villageMembership.update({ where: { id: membership.id }, data: { status: MembershipStatus.ACTIVE } });
    else await tx.villageMembership.update({ where: { id: membership.id }, data: { status: MembershipStatus.SUSPENDED } });
    await tx.auditLog.create({ data: { userId: actor.id, villageId: targetVillageId, action: AuditAction.UPDATE, resource: "MembershipSupport", resourceId: membership.id, metadata: { actorRole: "SUPERADMIN", targetVillageId, reason, oldValue: { role: membership.role, status: membership.status, houseId: membership.houseId }, newValue: { operation, houseId }, confirmedVacantHeadman: value(formData, "confirmVacant") === "true" } } });
  });
  revalidatePath(`/superadmin/villages/${targetVillageId}`);
}
