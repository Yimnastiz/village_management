"use server";

import { AuditAction, BindingRequestStatus, MembershipStatus, MovementType, NotificationType, PersonStatus, VillageMembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isRequestPlaceholderStatus } from "@/lib/settings-access";
import { requireSuperAdminActionSession } from "@/lib/superadmin";
import { isValidHouseNumber, normalizeHouseNumber } from "@/lib/house-number";
import { cleanupDuplicateUnboundUsersByNationalId, findBoundIdentityByNationalId, getNationalIdForUser, lockNationalIdClaim } from "@/lib/identity";
import { BINDING_DUPLICATE_PERSON_MESSAGE, BINDING_LINKED_PERSON_MESSAGE, reconcileBindingPersonIdentity } from "@/lib/binding-identity-reconciliation";
import { notifyVillageAdministrationOfSuperAdminIntervention } from "@/lib/superadmin-village-intervention";

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

function splitDisplayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "ไม่ระบุชื่อ", lastName: parts.slice(1).join(" ") || "ไม่ระบุนามสกุล" };
}

async function requireVillage(targetVillageId: string) {
  if (!targetVillageId) throw new Error("ต้องระบุหมู่บ้านเป้าหมาย");
  const village = await prisma.village.findUnique({ where: { id: targetVillageId }, select: { id: true, name: true } });
  if (!village) throw new Error("ไม่พบหมู่บ้านเป้าหมาย");
  return village;
}

function requireReason(formData: FormData) {
  const reason = value(formData, "reason");
  if (reason.length < 5) throw new Error("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร");
  return reason;
}

export type BindingReviewActionState = { success: boolean; message?: string };
class BindingReviewValidationError extends Error {}

async function reviewBindingSupportAction(
  _previousState: BindingReviewActionState,
  formData: FormData,
): Promise<BindingReviewActionState> {
  const actor = await requireSuperAdminActionSession();
  const requestId = value(formData, "requestId");
  const decision = value(formData, "decision");
  const selectedHouseId = value(formData, "selectedHouseId");
  const reviewReason = value(formData, "reviewReason");
  const supportReason = value(formData, "supportReason");
  const confirmMatchedPerson = value(formData, "confirmMatchedPerson") === "true";

  if (!requestId || !["APPROVE", "REJECT"].includes(decision)) return { success: false, message: "ข้อมูลคำขอไม่ครบถ้วน" };
  if (supportReason.length < 5) return { success: false, message: "กรุณาระบุเหตุผลในการดำเนินการแทนผู้ดูแลหมู่บ้านอย่างน้อย 5 ตัวอักษร" };
  if (decision === "REJECT" && reviewReason.length < 5) return { success: false, message: "กรุณาระบุเหตุผลที่ปฏิเสธคำขออย่างน้อย 5 ตัวอักษร" };
  // The request is the authoritative scope; never accept a village id from the browser.
  const requestScope = await prisma.bindingRequest.findUnique({ where: { id: requestId }, select: { villageId: true } });
  if (!requestScope) return { success: false, message: "ไม่พบคำขอผูกบ้าน" };
  const targetVillageId = requestScope.villageId;
  if (!targetVillageId) return { success: false, message: "คำขอผูกบ้านไม่มีหมู่บ้านเป้าหมาย" };
  const village = await prisma.village.findUnique({ where: { id: targetVillageId }, select: { id: true, name: true } });
  if (!village) return { success: false, message: "ไม่พบหมู่บ้านเป้าหมาย" };

  try {
    await prisma.$transaction(async (tx) => {
      const request = await tx.bindingRequest.findFirst({
        where: { id: requestId, villageId: targetVillageId, status: BindingRequestStatus.PENDING },
        include: {
          house: { select: { id: true, villageId: true, houseNumber: true } },
          user: { select: { id: true, name: true, phoneNumber: true, systemRole: true, accountStatus: true } },
        },
      });
      if (!request) throw new BindingReviewValidationError("ไม่พบคำขอในหมู่บ้านเป้าหมาย หรือคำขอนี้ถูกดำเนินการไปแล้ว");
      if (request.user.systemRole === "SUPERADMIN" || request.user.accountStatus !== "ACTIVE") throw new BindingReviewValidationError("บัญชีผู้ยื่นคำขอไม่พร้อมสำหรับการผูกสมาชิก");

      let resolvedHouseId: string | null = null;
      if (decision === "APPROVE") {
        let house = request.house;
        if (request.houseId) {
          if (!house || house.villageId !== targetVillageId) throw new BindingReviewValidationError("บ้านที่เลือกไม่ได้อยู่ในหมู่บ้านเป้าหมาย");
        } else {
          const normalizedHouseNumber = request.houseNumber ? normalizeHouseNumber(request.houseNumber) : "";
          if (!normalizedHouseNumber || !isValidHouseNumber(normalizedHouseNumber)) throw new BindingReviewValidationError("เลขบ้านที่เสนอไม่ถูกต้อง");
          if (selectedHouseId) house = await tx.house.findFirst({ where: { id: selectedHouseId, villageId: targetVillageId, normalizedHouseNumber }, select: { id: true, villageId: true, houseNumber: true } });
          else house = await tx.house.findFirst({ where: { villageId: targetVillageId, normalizedHouseNumber }, select: { id: true, villageId: true, houseNumber: true } });
          if (!house) throw new BindingReviewValidationError("เลขบ้านนี้ยังไม่อยู่ในทะเบียนบ้านของระบบ ต้องสร้างหรือจับคู่บ้านก่อนอนุมัติ");
        }
        resolvedHouseId = house.id;
        const nationalId = await getNationalIdForUser(tx, request.userId, targetVillageId);
        if (nationalId) await lockNationalIdClaim(tx, nationalId);
        if (nationalId && await findBoundIdentityByNationalId(tx, nationalId, request.userId, targetVillageId)) {
          throw new BindingReviewValidationError("เลขบัตรประชาชนนี้ถูกใช้กับบัญชีที่ผูกบ้านแล้ว ไม่สามารถอนุมัติคำขอได้");
        }
        const identityReconciliation = await reconcileBindingPersonIdentity(tx, { villageId: targetVillageId, nationalId, applicantUserId: request.userId });
        if (identityReconciliation.kind === "multiple_matches") throw new BindingReviewValidationError(BINDING_DUPLICATE_PERSON_MESSAGE);
        if (identityReconciliation.kind === "linked_to_another_user") throw new BindingReviewValidationError(BINDING_LINKED_PERSON_MESSAGE);
        if (identityReconciliation.kind === "single_unlinked_match" && !confirmMatchedPerson) {
          throw new BindingReviewValidationError("กรุณายืนยันการใช้ข้อมูลบุคคลในทะเบียนที่ตรงกับผู้สมัครก่อนอนุมัติ");
        }
        await tx.villageMembership.upsert({ where: { userId_villageId: { userId: request.userId, villageId: targetVillageId } }, update: { status: MembershipStatus.ACTIVE, houseId: house.id, joinedAt: new Date() }, create: { userId: request.userId, villageId: targetVillageId, role: VillageMembershipRole.RESIDENT, status: MembershipStatus.ACTIVE, houseId: house.id, joinedAt: new Date() } });
        const linkedPerson = await tx.person.findUnique({ where: { userId: request.userId }, select: { id: true, houseId: true, villageId: true, dateOfBirth: true, gender: true } });
        const reconciledPerson = identityReconciliation.kind === "single_unlinked_match"
          ? await tx.person.findUnique({ where: { id: identityReconciliation.person.id }, select: { id: true, houseId: true, villageId: true, dateOfBirth: true, gender: true } })
          : null;
        if (linkedPerson && linkedPerson.villageId !== targetVillageId) throw new BindingReviewValidationError("ข้อมูลบุคคลของผู้ใช้เชื่อมกับหมู่บ้านอื่น");
        const registration = await tx.registrationTemp.findFirst({ where: { userId: request.userId, villageId: targetVillageId, status: "VERIFIED" }, orderBy: { updatedAt: "desc" }, select: { firstName: true, lastName: true, nationalId: true, dateOfBirth: true, gender: true } });
        const existingPerson = reconciledPerson ?? linkedPerson;
        if (identityReconciliation.kind === "single_unlinked_match" && !reconciledPerson) throw new BindingReviewValidationError("ไม่พบข้อมูลบุคคลในทะเบียนที่เลือก กรุณารีเฟรชและตรวจสอบอีกครั้ง");
        if (existingPerson) {
          const reusingRegistryPerson = identityReconciliation.kind === "single_unlinked_match";
          await tx.person.update({ where: { id: existingPerson.id }, data: { userId: request.userId, houseId: house.id, ...(reusingRegistryPerson ? {} : { status: PersonStatus.ACTIVE, phone: request.user.phoneNumber, ...(existingPerson.dateOfBirth || !registration?.dateOfBirth ? {} : { dateOfBirth: registration.dateOfBirth }), ...(existingPerson.gender || !registration?.gender ? {} : { gender: registration.gender }) }) } });
          if (existingPerson.houseId !== house.id) {
            if (existingPerson.houseId) await tx.personMovement.create({ data: { personId: existingPerson.id, houseId: existingPerson.houseId, movementType: MovementType.MOVE_OUT, date: new Date(), note: "ผูกเลขบ้านใหม่" } });
            await tx.personMovement.create({ data: { personId: existingPerson.id, houseId: house.id, movementType: MovementType.MOVE_IN, date: new Date(), note: "ผูกเลขบ้านใหม่" } });
          }
          await tx.auditLog.create({ data: { userId: actor.id, villageId: targetVillageId, action: AuditAction.UPDATE, resource: "Person", resourceId: existingPerson.id, metadata: { actionName: "PERSON_ACTIVATED_BY_BINDING", bindingRequestId: request.id, houseId: house.id, actorRole: "SUPERADMIN", reconciledImportedPerson: identityReconciliation.kind === "single_unlinked_match" } } });
        } else {
          const names = splitDisplayName(request.user.name);
          const person = await tx.person.create({ data: { userId: request.userId, villageId: targetVillageId, houseId: house.id, firstName: registration?.firstName ?? names.firstName, lastName: registration?.lastName ?? names.lastName, nationalId: registration?.nationalId ?? nationalId ?? null, dateOfBirth: registration?.dateOfBirth ?? null, gender: registration?.gender ?? null, phone: request.user.phoneNumber, status: PersonStatus.ACTIVE } });
          await tx.personMovement.create({ data: { personId: person.id, houseId: house.id, movementType: MovementType.MOVE_IN, date: new Date(), note: "อนุมัติการผูกเลขบ้าน" } });
          await tx.auditLog.create({ data: { userId: actor.id, villageId: targetVillageId, action: AuditAction.CREATE, resource: "Person", resourceId: person.id, metadata: { actionName: "PERSON_CREATED_BY_BINDING", bindingRequestId: request.id, houseId: house.id, actorRole: "SUPERADMIN" } } });
        }
        await tx.user.update({ where: { id: request.userId }, data: { citizenVerifiedAt: new Date(), registrationVillageId: targetVillageId } });
        await tx.authSession.updateMany({ where: { userId: request.userId, expiresAt: { gt: new Date() } }, data: { activeVillageId: targetVillageId } });
        if (nationalId) await cleanupDuplicateUnboundUsersByNationalId(tx, nationalId, request.userId, { actorId: actor.id, villageId: targetVillageId });
      } else {
        const placeholder = await tx.villageMembership.findUnique({ where: { userId_villageId: { userId: request.userId, villageId: targetVillageId } }, select: { id: true, status: true } });
        if (!placeholder) await tx.villageMembership.create({ data: { userId: request.userId, villageId: targetVillageId, role: VillageMembershipRole.RESIDENT, status: MembershipStatus.REJECTED } });
        else if (isRequestPlaceholderStatus(placeholder.status)) await tx.villageMembership.update({ where: { id: placeholder.id }, data: { status: MembershipStatus.REJECTED, houseId: null, joinedAt: null } });
      }

      await tx.bindingRequest.update({ where: { id: request.id }, data: { status: decision === "APPROVE" ? BindingRequestStatus.APPROVED : BindingRequestStatus.REJECTED, houseId: decision === "APPROVE" ? resolvedHouseId : null, reviewedBy: actor.id, reviewedAt: new Date(), reviewNote: decision === "REJECT" ? reviewReason : null } });
      await tx.notification.create({ data: { userId: request.userId, villageId: targetVillageId, type: NotificationType.BINDING_REQUEST, title: decision === "APPROVE" ? "คำขอผูกบ้านได้รับการอนุมัติ" : "คำขอผูกบ้านถูกปฏิเสธ", body: decision === "APPROVE" ? `คำขอผูกบ้านของคุณใน ${village.name} ได้รับการอนุมัติแล้ว` : `คำขอผูกบ้านถูกปฏิเสธ: ${reviewReason}`, metadata: { bindingRequestId: request.id, action: decision.toLowerCase(), actionUrl: decision === "APPROVE" ? "/resident/dashboard" : "/resident/binding/pending" } } });
      await tx.auditLog.create({ data: { userId: actor.id, villageId: targetVillageId, action: decision === "APPROVE" ? AuditAction.APPROVE : AuditAction.REJECT, resource: "BindingRequestSupport", resourceId: request.id, metadata: { actorRole: "SUPERADMIN", targetVillageId, targetName: request.user.name, targetUserId: request.userId, phone: request.user.phoneNumber, supportReason, oldValue: { status: "PENDING" }, newValue: { status: decision === "APPROVE" ? "APPROVED" : "REJECTED", houseId: resolvedHouseId } } } });
      await notifyVillageAdministrationOfSuperAdminIntervention(tx, { villageId: targetVillageId, actionLabel: decision === "APPROVE" ? "อนุมัติคำขอผูกเลขบ้าน" : "ปฏิเสธคำขอผูกเลขบ้าน", supportReason, targetType: "BindingRequest", targetId: request.id, targetName: request.user.name, actionUrl: `/admin/population/binding-requests/${request.id}`, metadata: { bindingRequestId: request.id } });
    });
  } catch (error) {
    if (error instanceof BindingReviewValidationError) return { success: false, message: error.message };
    return { success: false, message: "ไม่สามารถบันทึกผลการพิจารณาได้ โปรดลองอีกครั้ง" };
  }
  revalidatePath(`/superadmin/villages/${targetVillageId}`);
  revalidatePath("/superadmin/data-quality");
  return { success: true, message: decision === "APPROVE" ? "อนุมัติคำขอและผูกสมาชิกเรียบร้อยแล้ว" : "ปฏิเสธคำขอเรียบร้อยแล้ว" };
}

export async function reviewBindingForWorkspaceAction(
  previousState: BindingReviewActionState,
  formData: FormData,
): Promise<BindingReviewActionState> {
  return reviewBindingSupportAction(previousState, formData);
}

export async function setVillageAdminSupportAction(targetVillageId: string, formData: FormData) {
  const actor = await requireSuperAdminActionSession();
  const userId = value(formData, "userId"); const roleValue = value(formData, "role"); const reason = requireReason(formData);
  await requireVillage(targetVillageId);
  if (roleValue !== VillageMembershipRole.HEADMAN && roleValue !== VillageMembershipRole.ASSISTANT_HEADMAN) throw new Error("บทบาทไม่ถูกต้อง");
  const role = roleValue === VillageMembershipRole.HEADMAN ? VillageMembershipRole.HEADMAN : VillageMembershipRole.ASSISTANT_HEADMAN;
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: {
        id: userId,
        accountStatus: "ACTIVE",
        systemRole: { not: "SUPERADMIN" },
        OR: [
          { memberships: { some: { villageId: targetVillageId } } },
          { registrationVillageId: targetVillageId },
        ],
      },
      select: { id: true, name: true, phoneNumber: true, systemRole: true, accountStatus: true },
    });
    if (!user || user.systemRole === "SUPERADMIN" || user.accountStatus !== "ACTIVE") throw new Error("ไม่สามารถแต่งตั้งบัญชีนี้ได้");
    if (role === VillageMembershipRole.HEADMAN) await tx.villageMembership.updateMany({ where: { villageId: targetVillageId, role: VillageMembershipRole.HEADMAN, status: MembershipStatus.ACTIVE, userId: { not: userId } }, data: { status: MembershipStatus.SUSPENDED } });
    const membership = await tx.villageMembership.upsert({ where: { userId_villageId: { userId, villageId: targetVillageId } }, update: { role, status: MembershipStatus.ACTIVE, houseId: null, joinedAt: new Date() }, create: { userId, villageId: targetVillageId, role, status: MembershipStatus.ACTIVE, joinedAt: new Date() } });
    await tx.auditLog.create({ data: { userId: actor.id, villageId: targetVillageId, action: AuditAction.APPROVE, resource: "VillageAdminSupport", resourceId: membership.id, metadata: { actorRole: "SUPERADMIN", targetName: user.name, targetUserId: user.id, membershipId: membership.id, phone: user.phoneNumber, targetVillageId, supportReason: reason, newValue: { role, status: MembershipStatus.ACTIVE } } } });
    await notifyVillageAdministrationOfSuperAdminIntervention(tx, { villageId: targetVillageId, actionLabel: "กำหนดบทบาทผู้ดูแลหมู่บ้าน", supportReason: reason, targetType: "VillageMembership", targetId: membership.id, targetName: user.name, actionUrl: "/admin", metadata: { membershipId: membership.id } });
  });
  revalidatePath(`/superadmin/villages/${targetVillageId}`);
  return { success: true, message: "แต่งตั้งผู้ดูแลเรียบร้อยแล้ว" };
}

export async function changeMembershipSupportAction(targetVillageId: string, formData: FormData) {
  const actor = await requireSuperAdminActionSession();
  const membershipId = value(formData, "membershipId"); const operation = value(formData, "operation"); const houseId = value(formData, "houseId") || null; const reason = requireReason(formData);
  await requireVillage(targetVillageId);
  if (!["SUSPEND", "ACTIVATE", "RESIDENT"].includes(operation)) throw new Error("รายการดำเนินการไม่ถูกต้อง");
  await prisma.$transaction(async (tx) => {
    const membership = await tx.villageMembership.findFirst({ where: { id: membershipId, villageId: targetVillageId }, select: { id: true, userId: true, role: true, status: true, houseId: true, user: { select: { name: true, phoneNumber: true } } } });
    if (!membership) throw new Error("Membership ไม่อยู่ในหมู่บ้านเป้าหมาย");
    if (membership.role === VillageMembershipRole.HEADMAN && operation === "SUSPEND" && value(formData, "confirmVacant") !== "true") throw new Error("การระงับ Headman ต้องยืนยันว่าหมู่บ้านจะอยู่ในสถานะยังไม่มีผู้ใหญ่บ้าน หรือแต่งตั้งผู้ใหม่ก่อน");
    const nextRole = operation === "RESIDENT" ? VillageMembershipRole.RESIDENT : membership.role;
    const nextStatus = operation === "SUSPEND" ? MembershipStatus.SUSPENDED : MembershipStatus.ACTIVE;
    if (operation === "RESIDENT") {
      if (!houseId || !await tx.house.findFirst({ where: { id: houseId, villageId: targetVillageId } })) throw new Error("ต้องเลือกบ้านที่อยู่ในหมู่บ้านนี้ก่อนเปลี่ยนเป็น Resident");
      await tx.villageMembership.update({ where: { id: membership.id }, data: { role: nextRole, status: nextStatus, houseId } });
    } else await tx.villageMembership.update({ where: { id: membership.id }, data: { status: nextStatus } });
    await tx.auditLog.create({ data: { userId: actor.id, villageId: targetVillageId, action: AuditAction.UPDATE, resource: "MembershipSupport", resourceId: membership.id, metadata: { actorRole: "SUPERADMIN", targetName: membership.user.name, targetUserId: membership.userId, membershipId: membership.id, phone: membership.user.phoneNumber, targetVillageId, supportReason: reason, oldValue: { role: membership.role, status: membership.status }, newValue: { role: nextRole, status: nextStatus }, confirmedVacantHeadman: value(formData, "confirmVacant") === "true" } } });
    await notifyVillageAdministrationOfSuperAdminIntervention(tx, { villageId: targetVillageId, actionLabel: "เปลี่ยนสถานะสมาชิกหมู่บ้าน", supportReason: reason, targetType: "VillageMembership", targetId: membership.id, targetName: membership.user.name, actionUrl: "/admin", metadata: { membershipId: membership.id, operation } });
  });
  revalidatePath(`/superadmin/villages/${targetVillageId}`);
  const returnTo = value(formData, "returnTo") === "admins" ? "admins" : "users";
  return { success: true, message: "ปรับข้อมูลสมาชิกเรียบร้อยแล้ว", returnTo };
}
