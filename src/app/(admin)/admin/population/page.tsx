"use server";

import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { revalidateAdminSidebar } from "@/lib/revalidate-admin-sidebar";
import { AuditAction, BindingRequestStatus, HouseSourceType, MembershipStatus, MovementType, NotificationType, Prisma, RegistrationTempStatus, SystemRole, VillageMembershipRole } from "@prisma/client";
import { getSessionContextFromServerCookies, isAdminUser, computeLandingPath } from "@/lib/access-control";
import { OCCUPANCY_STATUS_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { isValidHouseNumber, normalizeHouseNumber } from "@/lib/house-number";
import { maskNationalId } from "@/lib/utils";
import { cleanupDuplicateUnboundUsersByNationalId, findBoundIdentityByNationalId, getNationalIdForUser, lockNationalIdClaim } from "@/lib/identity";
import { BindingReviewForm } from "./binding-review-form";

const ADMIN_MEMBERSHIP_ROLES: Set<VillageMembershipRole> = new Set([
  VillageMembershipRole.HEADMAN,
  VillageMembershipRole.ASSISTANT_HEADMAN,
  VillageMembershipRole.COMMITTEE,
]);

type PendingBindingRequest = {
  id: string;
  villageId: string | null;
  houseId: string | null;
  houseNumber: string | null;
  note: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    phoneNumber: string;
  };
  village: {
    id: string;
    name: string | null;
  } | null;
  house: {
    id: string;
    houseNumber: string;
    normalizedHouseNumber: string;
    villageId: string;
  } | null;
  person: {
    id: string;
    userId: string | null;
    nationalId: string | null;
    houseId: string | null;
    houseNumber: string | null;
  } | null;
  duplicateNationalIdCount: number;
  nationalIdClaimed: boolean;
  duplicateApplicants: Array<{
    id: string;
    name: string;
    phoneNumber: string;
    createdAt: Date;
    status: "PENDING" | "UNBOUND";
  }>;
};

export type BindingReviewActionState = { success: boolean; message?: string };
class BindingReviewValidationError extends Error {}

function splitDisplayName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: "ไม่ระบุ", lastName: "-" };
  }

  const parts = trimmed.split(/\s+/);
  const firstName = parts[0] ?? "ไม่ระบุ";
  const lastName = parts.slice(1).join(" ") || "-";
  return { firstName, lastName };
}

function getBindingDisplayHouseNumber(request: {
  house?: { houseNumber: string } | null;
  houseNumber?: string | null;
}) {
  return request.house?.houseNumber ?? request.houseNumber ?? "ยังไม่ได้ระบุเลขบ้าน";
}

function getBindingHouseSourceLabel(request: {
  houseId?: string | null;
  house?: { houseNumber: string } | null;
  houseNumber?: string | null;
}) {
  if (request.houseId && request.house) return "เลือกจากทะเบียนบ้านในระบบ";
  if (request.houseNumber) return "ลูกบ้านเสนอเลขบ้านนี้ ต้องตรวจสอบก่อนสร้างหรือจับคู่บ้าน";
  return "ยังไม่ได้ระบุเลขบ้าน";
}

async function getPendingBindingRequests(
  isSuperAdmin: boolean,
  villageIds: string[]
) {
  if (!isSuperAdmin && villageIds.length === 0) {
    return [] as PendingBindingRequest[];
  }

  const where: Prisma.BindingRequestWhereInput = {
    status: BindingRequestStatus.PENDING,
  };
  if (!isSuperAdmin) {
    where.villageId = { in: villageIds };
  }

  const requests = await prisma.bindingRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    distinct: ["userId"],
    include: {
      user: {
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          person: { select: { id: true, userId: true, nationalId: true, houseId: true, house: { select: { houseNumber: true } } } },
        },
      },
      village: {
        select: {
          id: true,
          name: true,
        },
      },
      house: {
        select: {
          id: true,
          houseNumber: true,
          normalizedHouseNumber: true,
          villageId: true,
        },
      },
    },
  });
  return Promise.all(requests.map(async (request) => {
    const registration = request.user.person?.nationalId ? null : await prisma.registrationTemp.findFirst({
      where: { phoneNumber: request.user.phoneNumber, villageId: request.villageId ?? undefined, status: RegistrationTempStatus.VERIFIED },
      orderBy: { updatedAt: "desc" },
      select: { nationalId: true },
    });
    const nationalId = request.user.person?.nationalId ?? registration?.nationalId ?? null;
    const duplicateRegistrations = nationalId ? await prisma.registrationTemp.findMany({
      where: { nationalId, villageId: request.villageId ?? undefined, status: RegistrationTempStatus.VERIFIED, phoneNumber: { not: request.user.phoneNumber } },
      orderBy: { createdAt: "asc" },
      select: { phoneNumber: true, createdAt: true },
    }) : [];
    const duplicateUsers = duplicateRegistrations.length ? await prisma.user.findMany({
      where: { phoneNumber: { in: duplicateRegistrations.map((item) => item.phoneNumber) }, accountStatus: "ACTIVE", memberships: { none: { status: MembershipStatus.ACTIVE } } },
      select: { id: true, name: true, phoneNumber: true },
    }) : [];
    const registrationDateByPhone = new Map(duplicateRegistrations.map((item) => [item.phoneNumber, item.createdAt]));
    const duplicateApplicants = duplicateUsers.map((user) => ({
      ...user,
      createdAt: registrationDateByPhone.get(user.phoneNumber) ?? request.createdAt,
      status: "PENDING" as const,
    }));
    const [claimed, personDuplicateCount] = nationalId ? await Promise.all([
      findBoundIdentityByNationalId(prisma, nationalId, request.user.id, request.villageId),
      prisma.person.count({ where: { nationalId, villageId: request.villageId ?? undefined, userId: { not: request.user.id } } }),
    ]) : [null, 0];
    return {
      ...request,
      person: request.user.person && request.user.person.house
        ? { ...request.user.person, houseNumber: request.user.person.house.houseNumber }
        : request.user.person ? { ...request.user.person, houseNumber: null } : null,
      duplicateNationalIdCount: Math.max(personDuplicateCount, duplicateApplicants.length),
      nationalIdClaimed: Boolean(claimed),
      duplicateApplicants,
    };
  }));
}

export async function handleBindingRequestAction(_previousState: BindingReviewActionState, formData: FormData): Promise<BindingReviewActionState> {
  const session = await getSessionContextFromServerCookies();
  if (!session) {
    redirect("/auth/login?callbackUrl=/admin/population");
  }

  if (!isAdminUser(session)) {
    redirect(computeLandingPath(session));
  }

  const requestId = formData.get("requestId");
  const action = formData.get("action");
  const reviewNote = (formData.get("reviewNote") ?? "").toString().trim();

  if (!requestId || typeof requestId !== "string") return { success: false, message: "ไม่พบรหัสคำขอ" };
  if (!action || (action !== "approve" && action !== "reject")) return { success: false, message: "ประเภทการดำเนินการไม่ถูกต้อง" };
  if (action === "reject" && reviewNote.length < 1) return { success: false, message: "กรุณาระบุเหตุผลการปฏิเสธ" };

  const binding = await prisma.bindingRequest.findUnique({
    where: { id: requestId },
  });
  if (!binding) return { success: false, message: "ไม่พบคำขอผูกบ้าน" };
  if (!binding.villageId) return { success: false, message: "คำขอไม่มีข้อมูลหมู่บ้าน" };

  if (binding.status !== BindingRequestStatus.PENDING) return { success: false, message: "คำขอนี้ได้รับการดำเนินการแล้ว" };

  const canManage =
    session.systemRole !== SystemRole.SUPERADMIN &&
    session.memberships.some(
      (membership) =>
        (membership.role === VillageMembershipRole.HEADMAN || membership.role === VillageMembershipRole.ASSISTANT_HEADMAN) &&
        membership.status === MembershipStatus.ACTIVE &&
        membership.villageId === binding.villageId
    );
  if (!canManage) {
    return { success: false, message: "คุณไม่มีสิทธิ์จัดการคำขอนี้" };
  }

  const now = new Date();
  const status = action === "approve" ? BindingRequestStatus.APPROVED : BindingRequestStatus.REJECTED;
  const membershipStatus = action === "approve" ? MembershipStatus.ACTIVE : MembershipStatus.REJECTED;
  const confirmPersonHouseChange = formData.get("confirmPersonHouseChange") === "true";
  let releasedDuplicateCount = 0;

  try { await prisma.$transaction(async (tx) => {
    let resolvedHouseId: string | null = null;
    let nationalIdForBinding: string | null = null;

    if (action === "approve") {
      if (binding.houseId) {
        const house = await tx.house.findFirst({ where: { id: binding.houseId, villageId: binding.villageId! }, select: { id: true } });
        if (!house) throw new BindingReviewValidationError("บ้านที่ผูกไว้ไม่ได้อยู่ในหมู่บ้านของคำขอ");
        resolvedHouseId = house.id;
      } else throw new BindingReviewValidationError("เลขบ้านนี้ยังไม่อยู่ในทะเบียนบ้านของระบบ ต้องสร้างหรือจับคู่บ้านก่อนอนุมัติ");

      nationalIdForBinding = await getNationalIdForUser(tx, binding.userId, binding.villageId);
      if (nationalIdForBinding) await lockNationalIdClaim(tx, nationalIdForBinding);
      if (nationalIdForBinding && await findBoundIdentityByNationalId(tx, nationalIdForBinding, binding.userId, binding.villageId)) {
        throw new BindingReviewValidationError("เลขบัตรประชาชนนี้ถูกใช้กับบัญชีที่ผูกบ้านแล้ว ไม่สามารถอนุมัติคำขอได้");
      }
    }

    await tx.bindingRequest.update({
      where: { id: requestId },
      data: {
        status,
        houseId: action === "approve" ? resolvedHouseId : null,
        reviewedBy: session.id,
        reviewedAt: now,
        reviewNote: reviewNote || null,
      },
    });

    await tx.auditLog.create({ data: { userId: session.id, villageId: binding.villageId, action: action === "approve" ? AuditAction.APPROVE : AuditAction.REJECT, resource: "BindingRequest", resourceId: requestId, metadata: { actionName: action === "approve" ? "BINDING_APPROVED_TO_EXISTING_HOUSE" : "BINDING_REJECTED", houseId: resolvedHouseId, reviewNote: reviewNote || null } } });

    await tx.villageMembership.upsert({
      where: {
        userId_villageId: {
          userId: binding.userId,
          villageId: binding.villageId!,
        },
      },
      update: {
        status: membershipStatus,
        houseId: action === "approve" ? resolvedHouseId : null,
        joinedAt: membershipStatus === MembershipStatus.ACTIVE ? now : null,
      },
      create: {
        userId: binding.userId,
        villageId: binding.villageId!,
        role: VillageMembershipRole.RESIDENT,
        status: membershipStatus,
        houseId: action === "approve" ? resolvedHouseId : null,
        joinedAt: membershipStatus === MembershipStatus.ACTIVE ? now : null,
      },
    });

    if (action === "approve") {
      await tx.user.update({
        where: { id: binding.userId },
        data: {
          citizenVerifiedAt: now,
          registrationVillageId: binding.villageId,
        },
      });
      await tx.authSession.updateMany({
        where: { userId: binding.userId, expiresAt: { gt: now } },
        data: { activeVillageId: binding.villageId },
      });

      if (resolvedHouseId) {
        const residentUser = await tx.user.findUnique({
          where: { id: binding.userId },
          select: {
            name: true,
            phoneNumber: true,
          },
        });

        if (residentUser) {
          const names = splitDisplayName(residentUser.name);
          const registration = residentUser.phoneNumber ? await tx.registrationTemp.findFirst({
            where: { phoneNumber: residentUser.phoneNumber, villageId: binding.villageId!, status: RegistrationTempStatus.VERIFIED },
            orderBy: { updatedAt: "desc" },
            select: { nationalId: true },
          }) : null;
          const linkedPerson = await tx.person.findUnique({ where: { userId: binding.userId }, select: { id: true, userId: true, houseId: true, villageId: true } });
          if (linkedPerson && linkedPerson.villageId !== binding.villageId) throw new BindingReviewValidationError("ข้อมูลบุคคลของผู้ใช้อยู่คนละหมู่บ้านกับคำขอ");
          // A duplicate national ID must never select another applicant's Person row.
          // The account-owned record is the sole profile record eligible for approval.
          const existingPerson = linkedPerson;
          if (existingPerson?.userId && existingPerson.userId !== binding.userId) throw new BindingReviewValidationError("ข้อมูลบุคคลนี้ถูกผูกกับบัญชีอื่นแล้ว ไม่สามารถผูกทับได้");
          if (existingPerson?.houseId && existingPerson.houseId !== resolvedHouseId && !confirmPersonHouseChange) throw new BindingReviewValidationError("บ้านที่คำขอเลือกไม่ตรงกับข้อมูลทะเบียนประชากร กรุณายืนยันการแก้ไขข้อมูลทะเบียนก่อนอนุมัติ");

          if (existingPerson) {
            await tx.person.update({
              where: { id: existingPerson.id },
              data: {
                villageId: binding.villageId,
                houseId: resolvedHouseId,
                userId: binding.userId,
              },
            });
            if (existingPerson.houseId !== resolvedHouseId) {
              if (existingPerson.houseId) await tx.personMovement.create({ data: { personId: existingPerson.id, houseId: existingPerson.houseId, movementType: MovementType.MOVE_OUT, date: new Date() } });
              await tx.personMovement.create({ data: { personId: existingPerson.id, houseId: resolvedHouseId, movementType: MovementType.MOVE_IN, date: new Date() } });
            }
          } else {
            const person = await tx.person.create({
              data: {
                villageId: binding.villageId,
                houseId: resolvedHouseId,
                firstName: names.firstName,
                lastName: names.lastName,
                phone: residentUser.phoneNumber,
                userId: binding.userId,
                nationalId: registration?.nationalId ?? null,
              },
            });
            await tx.personMovement.create({ data: { personId: person.id, houseId: resolvedHouseId, movementType: MovementType.MOVE_IN, date: new Date() } });
          }
        }
      }

      if (nationalIdForBinding) {
        releasedDuplicateCount = await cleanupDuplicateUnboundUsersByNationalId(tx, nationalIdForBinding, binding.userId, { actorId: session.id, villageId: binding.villageId });
      }

      // Notify resident of approval with action link
      await tx.notification.create({
        data: {
          userId: binding.userId,
          villageId: binding.villageId,
          type: NotificationType.BINDING_REQUEST,
          title: "การผูกบัญชีได้รับการอนุมัติแล้ว",
          body: "ยินดีด้วย! การผูกบัญชีของคุณได้รับการอนุมัติ คุณสามารถเข้าสู่ระบบและใช้งานโปรแกรมได้แล้ว",
          metadata: { 
            bindingRequestId: requestId, 
            action: "approved",
            actionUrl: "/resident/dashboard",
            actionLabel: "ไปไปที่หน้าแรก"
          },
        },
      });
    } else {
      // Notify resident of rejection
      await tx.notification.create({
        data: {
          userId: binding.userId,
          villageId: binding.villageId,
          type: NotificationType.BINDING_REQUEST,
          title: "การผูกบัญชีถูกปฏิเสธ",
          body: reviewNote ? `การผูกบัญชีของคุณถูกปฏิเสธ เหตุผล: ${reviewNote}` : "การผูกบัญชีของคุณถูกปฏิเสธ",
          metadata: { bindingRequestId: requestId, action: "rejected", reason: reviewNote },
        },
      });
    }
  }); } catch (error) { if (error instanceof BindingReviewValidationError) return { success: false, message: error.message }; throw error; }

  revalidatePath("/admin/population");
  revalidateAdminSidebar();
  revalidatePath("/admin/population/binding-requests");
  revalidatePath(`/admin/population/binding-requests/${requestId}`);
  return {
    success: true,
    message: action === "approve"
      ? releasedDuplicateCount > 0
        ? `อนุมัติคำขอเรียบร้อย ปิดบัญชีซ้ำ ${releasedDuplicateCount} บัญชี และปล่อยเบอร์โทรให้สมัครใหม่แล้ว`
        : "อนุมัติคำขอเรียบร้อยแล้ว"
      : "ปฏิเสธคำขอเรียบร้อยแล้ว",
  };
}

export async function revertOrUpdateBindingAction(formData: FormData) {
  const session = await getSessionContextFromServerCookies();
  if (!session) {
    redirect("/auth/login?callbackUrl=/admin/population");
  }

  if (!isAdminUser(session)) {
    redirect(computeLandingPath(session));
  }

  const requestId = formData.get("requestId");
  const actionType = formData.get("actionType");
  const newStatus = (formData.get("newStatus") ?? "").toString().trim();
  const reviewNote = (formData.get("reviewNote") ?? "").toString().trim();

  if (!requestId || typeof requestId !== "string") {
    throw new Error("Missing requestId");
  }

  const binding = await prisma.bindingRequest.findUnique({
    where: { id: requestId },
    include: { user: true },
  });

  if (!binding) {
    throw new Error("Binding request not found");
  }

  if (!binding.villageId) {
    throw new Error("Binding request is missing village information");
  }

  const canManage =
    session.systemRole === SystemRole.SUPERADMIN ||
    session.memberships.some(
      (membership) =>
        ADMIN_MEMBERSHIP_ROLES.has(membership.role) &&
        membership.villageId === binding.villageId
    );

  if (!canManage) {
    throw new Error("Unauthorized");
  }

  const now = new Date();

  // Handle revert to PENDING
  if (actionType === "revert_to_pending") {
    await prisma.$transaction(async (tx) => {
      await tx.bindingRequest.update({
        where: { id: requestId },
        data: {
          status: BindingRequestStatus.PENDING,
          reviewedBy: null,
          reviewedAt: null,
          reviewNote: null,
        },
      });

      await tx.villageMembership.upsert({
        where: {
          userId_villageId: {
            userId: binding.userId,
            villageId: binding.villageId!,
          },
        },
        update: {
          status: MembershipStatus.PENDING,
          houseId: null,
          joinedAt: null,
        },
        create: {
          userId: binding.userId,
          villageId: binding.villageId!,
          role: VillageMembershipRole.RESIDENT,
          status: MembershipStatus.PENDING,
          houseId: null,
        },
      });

      // Clear citizen verification if approval was reverted
      if (binding.status === BindingRequestStatus.APPROVED) {
        await tx.user.update({
          where: { id: binding.userId },
          data: { citizenVerifiedAt: null },
        });
      }

      // Notify resident that decision was reverted
      await tx.notification.create({
        data: {
          userId: binding.userId,
          villageId: binding.villageId,
          type: NotificationType.BINDING_REQUEST,
          title: "การผูกบัญชีได้ถูกยกเลิกการตัดสินใจ",
          body: "การตัดสินใจของการผูกบัญชีนของคุณได้ถูกยกเลิก โปรดรอการพิจารณาใหม่",
          metadata: { bindingRequestId: requestId, action: "reverted" },
        },
      });
    });
  }
  // Handle change from APPROVED to REJECTED or vice versa
  else if (actionType === "change_decision" && newStatus) {
    if (!["APPROVED", "REJECTED"].includes(newStatus)) {
      throw new Error("Invalid new status");
    }

    const membershipStatus = newStatus === "APPROVED" ? MembershipStatus.ACTIVE : MembershipStatus.REJECTED;

    await prisma.$transaction(async (tx) => {
      let resolvedHouseId: string | null = null;
      let nationalIdForBinding: string | null = null;

      if (newStatus === "APPROVED") {
        if (binding.houseId) {
          const house = await tx.house.findFirst({ where: { id: binding.houseId, villageId: binding.villageId! }, select: { id: true } });
          if (!house) throw new Error("บ้านที่ผูกไว้ไม่ได้อยู่ในหมู่บ้านของคำขอ");
          resolvedHouseId = house.id;
      } else throw new Error("คำขอนี้ยังไม่ได้จับคู่กับบ้านในทะเบียน ต้องสร้างหรือจับคู่บ้านก่อนอนุมัติ");

        nationalIdForBinding = await getNationalIdForUser(tx, binding.userId, binding.villageId);
        if (nationalIdForBinding) await lockNationalIdClaim(tx, nationalIdForBinding);
        if (nationalIdForBinding && await findBoundIdentityByNationalId(tx, nationalIdForBinding, binding.userId, binding.villageId)) {
          throw new Error("เลขบัตรประชาชนนี้ถูกใช้กับบัญชีที่ผูกบ้านแล้ว ไม่สามารถอนุมัติคำขอได้");
        }
      }

      await tx.bindingRequest.update({
        where: { id: requestId },
        data: {
          status: newStatus as BindingRequestStatus,
          houseId: newStatus === "APPROVED" ? resolvedHouseId : null,
          reviewedBy: session.id,
          reviewedAt: now,
          reviewNote: reviewNote || null,
        },
      });

      await tx.villageMembership.update({
        where: {
          userId_villageId: {
            userId: binding.userId,
            villageId: binding.villageId!,
          },
        },
        data: {
          status: membershipStatus,
          houseId: newStatus === "APPROVED" ? resolvedHouseId : null,
          joinedAt: membershipStatus === MembershipStatus.ACTIVE ? now : null,
        },
      });

      if (newStatus === "APPROVED") {
        await tx.user.update({
          where: { id: binding.userId },
          data: { citizenVerifiedAt: now },
        });

        if (resolvedHouseId) {
          const residentUser = await tx.user.findUnique({
            where: { id: binding.userId },
            select: {
              name: true,
              phoneNumber: true,
            },
          });

          if (residentUser) {
            const names = splitDisplayName(residentUser.name);
            const existingPerson = await tx.person.findUnique({ where: { userId: binding.userId }, select: { id: true } });

            if (existingPerson) {
              await tx.person.update({
                where: { id: existingPerson.id },
                data: {
                  villageId: binding.villageId,
                  houseId: resolvedHouseId,
                  userId: binding.userId,
                },
              });
            } else {
              await tx.person.create({
                data: {
                  villageId: binding.villageId,
                  houseId: resolvedHouseId,
                  firstName: names.firstName,
                  lastName: names.lastName,
                  phone: residentUser.phoneNumber,
                  userId: binding.userId,
                },
              });
            }
          }
        }
        if (nationalIdForBinding) await cleanupDuplicateUnboundUsersByNationalId(tx, nationalIdForBinding, binding.userId, { actorId: session.id, villageId: binding.villageId });
      } else {
        await tx.user.update({
          where: { id: binding.userId },
          data: { citizenVerifiedAt: null },
        });
      }

      // Notify resident of decision change
      const title = newStatus === "APPROVED" ? "การผูกบัญชีได้รับการอนุมัติแล้ว" : "การผูกบัญชีถูกปฏิเสธ";
      let body = "";
      const metadata: {
        bindingRequestId: string;
        action: string;
        actionUrl?: string;
        actionLabel?: string;
        reason?: string;
      } = { bindingRequestId: requestId, action: newStatus.toLowerCase() };
      
      if (newStatus === "APPROVED") {
        body = "ยินดีด้วย! การผูกบัญชีของคุณได้รับการอนุมัติ คุณสามารถเข้าสู่ระบบและใช้งานโปรแกรมได้แล้ว";
        metadata.actionUrl = "/resident/dashboard";
        metadata.actionLabel = "ไปไปที่หน้าแรก";
      } else {
        body = reviewNote
          ? `การผูกบัญชีของคุณถูกปฏิเสธ เหตุผล: ${reviewNote}`
          : "การผูกบัญชีของคุณถูกปฏิเสธ";
        metadata.reason = reviewNote || undefined;
      }

      await tx.notification.create({
        data: {
          userId: binding.userId,
          villageId: binding.villageId,
          type: NotificationType.BINDING_REQUEST,
          title,
          body,
          metadata,
        },
      });
    });
  }

  revalidatePath("/admin/population");
  revalidatePath("/admin/population/binding-requests");
  revalidatePath(`/admin/population/binding-requests/${requestId}`);
}

export async function verifyHouseForBindingAction(_previousState: BindingReviewActionState, formData: FormData): Promise<BindingReviewActionState> {
  const session = await getSessionContextFromServerCookies();
  if (!session || !isAdminUser(session)) throw new Error("Unauthorized");
  const requestId = String(formData.get("requestId") ?? "");
  const selectedHouseId = String(formData.get("selectedHouseId") ?? "").trim();
  const sourceNote = String(formData.get("sourceNote") ?? "").trim();
  if (!requestId || sourceNote.length < 5) return { success: false, message: "กรุณาระบุเหตุผล/แหล่งที่มาของการยืนยันอย่างน้อย 5 ตัวอักษร" };
  try { await prisma.$transaction(async (tx) => {
    const request = await tx.bindingRequest.findFirst({ where: { id: requestId, status: BindingRequestStatus.PENDING } });
    if (!request?.villageId) throw new BindingReviewValidationError("ไม่พบคำขอที่รอตรวจสอบ");
    const canManage = session.memberships.some((m) => m.villageId === request.villageId && m.status === MembershipStatus.ACTIVE && (m.role === VillageMembershipRole.HEADMAN || m.role === VillageMembershipRole.ASSISTANT_HEADMAN));
    if (!canManage) throw new BindingReviewValidationError("คุณไม่มีสิทธิ์จัดการคำขอนี้");
    let houseId = selectedHouseId;
    if (houseId) {
      const house = await tx.house.findFirst({ where: { id: houseId, villageId: request.villageId }, select: { id: true } });
      if (!house) throw new BindingReviewValidationError("บ้านที่เลือกไม่อยู่ในหมู่บ้านนี้");
    } else {
      const normalized = normalizeHouseNumber(request.houseNumber ?? "");
      if (!isValidHouseNumber(normalized)) throw new BindingReviewValidationError("เลขบ้านที่ลูกบ้านแจ้งไม่ถูกต้อง");
      const existing = await tx.house.findUnique({ where: { villageId_normalizedHouseNumber: { villageId: request.villageId, normalizedHouseNumber: normalized } }, select: { id: true } });
      if (existing) houseId = existing.id;
      else {
        const house = await tx.house.create({ data: { villageId: request.villageId, houseNumber: request.houseNumber!.trim(), normalizedHouseNumber: normalized, sourceType: HouseSourceType.RESIDENT_REQUEST_VERIFIED, sourceNote, verifiedByUserId: session.id, verifiedAt: new Date() }, select: { id: true } });
        houseId = house.id;
        await tx.auditLog.create({ data: { userId: session.id, villageId: request.villageId, action: AuditAction.CREATE, resource: "House", resourceId: house.id, metadata: { actionName: "HOUSE_CREATED_FROM_VERIFIED_BINDING_REQUEST", bindingRequestId: request.id, sourceNote, normalizedHouseNumber: normalized } } });
      }
    }
    await tx.bindingRequest.update({ where: { id: request.id }, data: { houseId } });
    await tx.auditLog.create({ data: { userId: session.id, villageId: request.villageId, action: AuditAction.UPDATE, resource: "BindingRequest", resourceId: request.id, metadata: { actionName: "BINDING_MATCHED_TO_EXISTING_HOUSE", houseId, sourceNote } } });
  }); } catch (error) { if (error instanceof BindingReviewValidationError) return { success: false, message: error.message }; throw error; }
  revalidatePath("/admin/population");
  return { success: true, message: "สร้างหรือจับคู่บ้านเรียบร้อยแล้ว กรุณาตรวจสอบและอนุมัติคำขอ" };
}

type PageProps = {
  searchParams?: Promise<{ q?: string; occupancy?: string; historyQ?: string }>;
};

export default async function Page({ searchParams }: PageProps) {
  const session = await getSessionContextFromServerCookies();
  if (!session) {
    redirect("/auth/login?callbackUrl=/admin/population");
  }

  if (!isAdminUser(session)) {
    redirect(computeLandingPath(session));
  }

  // This route is deliberately an overview.  Binding review and house management
  // have their own routes so a review cannot be confused with household data.
  const manageableVillageIds = session.memberships
    .filter((membership) => membership.status === MembershipStatus.ACTIVE && ADMIN_MEMBERSHIP_ROLES.has(membership.role))
    .map((membership) => membership.villageId);
  const overviewWhere = session.systemRole === SystemRole.SUPERADMIN ? {} : { villageId: { in: manageableVillageIds } };
  const [overviewHouses, overviewPeople, overviewBoundMembers, overviewPendingBindings] = await Promise.all([
    prisma.house.count({ where: overviewWhere }),
    prisma.person.count({ where: overviewWhere }),
    prisma.villageMembership.count({ where: { ...overviewWhere, status: MembershipStatus.ACTIVE, houseId: { not: null } } }),
    prisma.bindingRequest.count({ where: { ...overviewWhere, status: BindingRequestStatus.PENDING } }),
  ]);

  const stats = [
    ["บ้านทั้งหมด", overviewHouses],
    ["ประชากรทั้งหมด", overviewPeople],
    ["สมาชิกที่ผูกบ้านแล้ว", overviewBoundMembers],
    ["คำขอผูกบ้านรอพิจารณา", overviewPendingBindings],
  ] as const;
  const modules = [
    { title: "ทะเบียนบ้าน", description: "ดู เพิ่ม และจัดการบ้านเลขที่", href: "/admin/population/houses", action: "เปิดทะเบียนบ้าน" },
    { title: "ทะเบียนประชากร", description: "ดู เพิ่ม และแก้ไขข้อมูลประชากร", href: "/admin/population/people", action: "เปิดทะเบียนประชากร" },
    { title: "คำขอผูกเลขบ้าน", description: "ตรวจสอบคำขอจากลูกบ้าน", href: "/admin/population/binding-requests", action: overviewPendingBindings ? `${overviewPendingBindings.toLocaleString("th-TH")} รายการรอพิจารณา` : "ตรวจสอบคำขอ" },
    { title: "นำเข้า/ส่งออก", description: "จัดการข้อมูลจำนวนมาก", href: "/admin/population/import", action: "จัดการข้อมูล" },
  ] as const;

  return <div className="space-y-6">
    <header>
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">ทะเบียนครัวเรือน</h1>
      <p className="mt-1 text-sm text-gray-500">ภาพรวมข้อมูลบ้าน ประชากร และการผูกบัญชีของหมู่บ้าน</p>
    </header>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(([label, value]) => <div key={label} className="rounded-xl border border-gray-200 bg-white px-4 py-3.5">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{value.toLocaleString("th-TH")}</p>
      </div>)}
    </section>
    <section className="grid gap-3 md:grid-cols-2">
      {modules.map((module) => <Link key={module.href} href={module.href} className="group flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-4 transition hover:border-gray-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
        <div className="min-w-0"><h2 className="font-semibold text-gray-900">{module.title}</h2><p className="mt-1 text-sm text-gray-500">{module.description}</p></div>
        <span className="shrink-0 text-sm font-medium text-blue-700 group-hover:text-blue-800">{module.action} →</span>
      </Link>)}
    </section>
  </div>;

  /* Legacy presentation below is intentionally unreachable while its server
     actions remain here for compatibility with the detail workflow. */
  const params = (searchParams ? await searchParams : {}) ?? {};

  const villageIds = session!.memberships
    .filter((m) => ADMIN_MEMBERSHIP_ROLES.has(m.role))
    .map((m) => m.villageId);

  const isSuperAdmin = session!.systemRole === SystemRole.SUPERADMIN;
  const houseKeyword = params.q?.trim() ?? "";
  const historyKeyword = params.historyQ?.trim() ?? "";
  const activeOccupancy = params.occupancy ?? "ALL";
  const historyClearParams = new URLSearchParams();
  if (houseKeyword) historyClearParams.set("q", houseKeyword);
  if (activeOccupancy !== "ALL") historyClearParams.set("occupancy", activeOccupancy);
  const historyClearHref = `/admin/population${historyClearParams.size ? `?${historyClearParams.toString()}` : ""}#binding-history`;

  const villageFilterForHomes = isSuperAdmin ? {} : { villageId: { in: villageIds } };
  const occupancyFilterForHomes =
    activeOccupancy !== "ALL"
      ? {
          occupancyStatus:
            activeOccupancy as "OCCUPIED" | "VACANT" | "UNDER_CONSTRUCTION" | "DEMOLISHED",
        }
      : {};

  const pendingRequests = await getPendingBindingRequests(
    isSuperAdmin,
    villageIds
  );

  const historyRequests = await getBindingRequestHistory(
    isSuperAdmin,
    villageIds,
    historyKeyword,
  );

  const [houses, totalHouses, occupiedHouses] = await Promise.all([
    prisma.house.findMany({
      where: {
        ...villageFilterForHomes,
        ...occupancyFilterForHomes,
        ...(houseKeyword
          ? {
              houseNumber: {
                contains: houseKeyword,
                mode: "insensitive",
              },
            }
          : {}),
      },
      select: {
        id: true,
        houseNumber: true,
        villageId: true,
        occupancyStatus: true,
        village: { select: { id: true, name: true } },
        _count: {
          select: {
            persons: true,
            memberships: true,
          },
        },
      },
      orderBy: [{ houseNumber: "asc" }],
      take: 120,
    }),
    prisma.house.count({
      where: {
        ...villageFilterForHomes,
      },
    }),
    prisma.house.count({
      where: {
        ...villageFilterForHomes,
        occupancyStatus: "OCCUPIED",
      },
    }),
  ]);

  const reviewerIds = historyRequests
    .map((req) => req.reviewedBy)
    .filter((id): id is string => Boolean(id));

  const reviewers = reviewerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: reviewerIds } },
        select: { id: true, name: true },
      })
    : [];

  const reviewerMap = reviewers.reduce<Record<string, string>>((acc, user) => {
    acc[user.id] = user.name;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ทะเบียนครัวเรือน</h1>
        <p className="text-gray-500 text-sm mt-1">
          ค้นหาเลขบ้าน เปิดดูรายละเอียดครัวเรือน และจัดการคำร้องผูกบ้าน
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">บ้านทั้งหมด</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{totalHouses.toLocaleString("th-TH")}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">บ้านที่มีผู้อยู่อาศัย</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{occupiedHouses.toLocaleString("th-TH")}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">คำร้องรอพิจารณา</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{pendingRequests.length.toLocaleString("th-TH")}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">ประวัติที่มีการตัดสินใจแล้ว</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{historyRequests.length.toLocaleString("th-TH")}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">ค้นหาเลขบ้าน</h2>
          <Link
            href="/admin/population/houses"
            className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            เปิดหน้าทะเบียนบ้านแบบเต็ม
          </Link>
        </div>

        <form method="get" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            name="q"
            defaultValue={houseKeyword}
            placeholder="ค้นหาเลขบ้าน เช่น 12/8"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            name="occupancy"
            defaultValue={activeOccupancy}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="ALL">ทุกสถานะ</option>
            <option value="OCCUPIED">มีผู้อยู่อาศัย</option>
            <option value="VACANT">ว่าง</option>
            <option value="UNDER_CONSTRUCTION">กำลังก่อสร้าง</option>
            <option value="DEMOLISHED">รื้อถอนแล้ว</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            ค้นหา
          </button>
          <Link
            href="/admin/population"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            ล้างตัวกรอง
          </Link>
        </form>

        <div className="mt-4 overflow-x-auto rounded-lg border border-gray-100">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3">บ้านเลขที่</th>
                <th className="px-4 py-3">หมู่บ้าน</th>
                <th className="px-4 py-3">สถานะ</th>
                <th className="px-4 py-3">จำนวนคน</th>
                <th className="px-4 py-3">รายละเอียด</th>
              </tr>
            </thead>
            <tbody>
              {houses.map((house) => (
                <tr key={house.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{house.houseNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{house.village.name}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {OCCUPANCY_STATUS_LABELS[house.occupancyStatus] ?? house.occupancyStatus}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{house._count.persons.toLocaleString("th-TH")}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/population/houses/${house.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      ดูรายละเอียด
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {houses.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-500">ไม่พบบ้านตามคำค้นหรือเงื่อนไขที่เลือก</p>
          ) : null}
        </div>
      </div>

      <div id="binding-requests" className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">คำร้องรอยืนยัน</h2>
        {pendingRequests.length === 0 ? (
          <p className="text-gray-500 text-sm text-center">ไม่มีคำร้องรอยืนยันในตอนนี้</p>
        ) : (
          <div className="space-y-6">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="rounded-xl border border-gray-100 bg-gray-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {request.user.name || request.user.phoneNumber}
                    </div>
                    <a href={`tel:${request.user.phoneNumber}`} className="text-sm font-medium text-green-700 hover:underline">
                      โทร {request.user.phoneNumber}
                    </a>
                  </div>
                  <div className="text-xs text-gray-500">
                    ส่งคำร้องเมื่อ {new Date(request.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <div className="text-xs text-gray-500">หมู่บ้าน</div>
                    <div className="text-sm font-medium text-gray-900">
                      {request.village?.name ?? "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">บ้านเลขที่</div>
                    <div className="text-sm font-medium text-gray-900">
                      {getBindingDisplayHouseNumber(request)}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {getBindingHouseSourceLabel(request)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">หมายเหตุ</div>
                    <div className="text-sm text-gray-900">{request.note ?? "-"}</div>
                  </div>
                </div>
                {request.person ? <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  ข้อมูลจากทะเบียนประชากร: {request.person.houseNumber ? `บ้านเลขที่ ${request.person.houseNumber}` : "ยังไม่มีบ้าน"} {request.person.nationalId ? `เลขบัตร ${maskNationalId(request.person.nationalId)}` : ""}
                  {request.person.houseId && request.houseId && request.person.houseId !== request.houseId ? <p className="mt-1 font-medium text-red-700">คำเตือน: บ้านที่ผู้ใช้เลือกไม่ตรงกับบ้านในข้อมูลทะเบียนประชากร</p> : null}
                </div> : null}
                {request.nationalIdClaimed ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">เลขบัตรนี้ถูกใช้กับบัญชีที่ผูกบ้านแล้ว จึงไม่สามารถอนุมัติคำขอได้</p> : request.duplicateNationalIdCount > 0 ? <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">มีบัญชีอื่นใช้เลขบัตรนี้อยู่ {request.duplicateNationalIdCount} บัญชี แต่ยังไม่มีบัญชีใดผูกบ้านสำเร็จ</p> : null}

                {request.duplicateApplicants.length > 0 ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-amber-950">พบผู้สมัครรายอื่นที่ใช้เลขบัตรเดียวกัน</p>
                  <p className="mt-1 text-xs leading-5 text-amber-900">เมื่ออนุมัติคำขอนี้ ระบบจะยกเลิกบัญชีที่ยังรออนุมัติเหล่านี้โดยอัตโนมัติ</p>
                  <ul className="mt-2 divide-y divide-amber-200 text-sm text-amber-950">
                    {request.duplicateApplicants.map((applicant) => <li key={applicant.id} className="grid gap-1 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3">
                      <span className="min-w-0 truncate font-medium">{applicant.name}</span>
                      <span className="text-xs text-amber-900 sm:text-right">{applicant.phoneNumber} · สมัคร {applicant.createdAt.toLocaleDateString("th-TH")} · รออนุมัติ</span>
                    </li>)}
                  </ul>
                </div> : null}
                {session!.memberships.some((membership) =>
                  membership.villageId === request.villageId &&
                  membership.status === MembershipStatus.ACTIVE &&
                  (membership.role === VillageMembershipRole.HEADMAN || membership.role === VillageMembershipRole.ASSISTANT_HEADMAN)
                ) ? <><BindingReviewForm reviewAction={handleBindingRequestAction} verifyAction={verifyHouseForBindingAction} requestId={request.id} houseId={request.houseId} houseNumber={request.houseNumber} villageId={request.villageId ?? ""} houses={houses} personHouseNumber={request.person?.houseNumber} personNationalId={request.person?.nationalId ? maskNationalId(request.person.nationalId) : null} houseMismatch={Boolean(request.person?.houseId && request.houseId && request.person.houseId !== request.houseId)} nationalIdClaimed={request.nationalIdClaimed} /><div className="hidden space-y-2">
                  <input type="hidden" name="requestId" value={request.id} />
                  {!request.houseId ? <div className="col-span-1 md:col-span-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="mb-2 text-sm font-medium text-amber-900">คำขอนี้เป็นข้อมูลที่ลูกบ้านแจ้ง ยังไม่ใช่ข้อมูลบ้านจริง ต้องจับคู่หรือสร้างบ้านหลังตรวจสอบก่อน</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      <select name="selectedHouseId" defaultValue="" className="rounded-lg border border-amber-300 bg-white p-2 text-sm"><option value="">สร้างบ้านใหม่จากคำขอที่ตรวจสอบแล้ว</option>{houses.filter((house) => house.villageId === request.villageId).map((house) => <option key={house.id} value={house.id}>จับคู่บ้านเลขที่ {house.houseNumber}</option>)}</select>
                      <input name="sourceNote" minLength={5} placeholder="เหตุผล/แหล่งที่มาที่ใช้ยืนยันเลขบ้าน" className="rounded-lg border border-amber-300 bg-white p-2 text-sm" />
                    </div>
                    <button type="button" className="mt-2 rounded-lg bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800">ยืนยันและสร้าง/จับคู่บ้าน</button>
                  </div> : null}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <textarea
                      name="reviewNote"
                      placeholder="หมายเหตุการอนุมัติ/ปฏิเสธ (ไม่บังคับ)"
                      className="col-span-1 md:col-span-2 w-full rounded-lg border border-gray-200 p-2 text-sm"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        name="action"
                        value="approve"
                        type="submit"
                        disabled={!request.houseId}
                        className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                      >
                        อนุมัติ
                      </button>
                      <button
                        name="action"
                        value="reject"
                        type="submit"
                        className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                      >
                        ปฏิเสธ
                      </button>
                    </div>
                  </div>
                </div></> : <p className="mt-4 text-sm text-gray-500">คุณมีสิทธิ์ดูคำขอนี้ แต่การอนุมัติหรือปฏิเสธต้องดำเนินการโดยผู้ใหญ่บ้านหรือผู้ช่วยผู้ใหญ่บ้าน</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div id="binding-history" className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">ประวัติการอนุมัติ/ปฏิเสธ</h2>
            <p className="mt-1 text-xs text-gray-500">ค้นหาจากชื่อ เบอร์โทรศัพท์ หรือบ้านเลขที่</p>
          </div>
          <form method="GET" action="/admin/population#binding-history" className="flex w-full gap-2 sm:max-w-md">
            {houseKeyword ? <input type="hidden" name="q" value={houseKeyword} /> : null}
            {activeOccupancy !== "ALL" ? <input type="hidden" name="occupancy" value={activeOccupancy} /> : null}
            <input
              type="search"
              name="historyQ"
              defaultValue={historyKeyword}
              placeholder="ชื่อ เบอร์โทร หรือเลขบ้าน"
              className="min-h-10 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
            <button type="submit" className="min-h-10 rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700">ค้นหา</button>
            {historyKeyword ? <Link href={historyClearHref} className="inline-flex min-h-10 items-center rounded-lg border border-gray-300 px-3 text-sm text-gray-700 hover:bg-gray-50">ล้าง</Link> : null}
          </form>
        </div>
        {historyRequests.length === 0 ? (
          <p className="text-gray-500 text-sm text-center">{historyKeyword ? "ไม่พบประวัติที่ตรงกับคำค้นหา" : "ยังไม่มีประวัติการอนุมัติหรือปฏิเสธ"}</p>
        ) : (
          <div className="space-y-4">
            {historyRequests.map((request) => (
              <div key={request.id} className="rounded-xl border border-gray-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-gray-500">ผู้ร้อง</div>
                    <div className="text-sm font-medium text-gray-900">
                      {request.user.name || request.user.phoneNumber}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">หมู่บ้าน</div>
                    <div className="text-sm text-gray-700">{request.village?.name ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">บ้านเลขที่</div>
                    <div className="text-sm text-gray-700">{getBindingDisplayHouseNumber(request)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-gray-500">สถานะ</div>
                    <div
                      className={`text-sm font-semibold ${request.status === BindingRequestStatus.APPROVED ? "text-green-700" : "text-red-700"}`}
                    >
                      {request.status}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">ผู้ตรวจสอบ</div>
                    <div className="text-sm text-gray-700">
                      {request.reviewedBy ? reviewerMap[request.reviewedBy] || "-" : "-"}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-xs text-gray-500">เวลา</div>
                    <div className="text-sm text-gray-700">
                      {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : "-"}
                    </div>
                  </div>
                </div>

                {request.reviewNote && (
                  <div className="mb-4 p-2 bg-gray-50 rounded text-sm text-gray-700">
                    <div className="text-xs text-gray-500 mb-1">หมายเหตุ:</div>
                    {request.reviewNote}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  <form action={revertOrUpdateBindingAction} style={{ display: "contents" }}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="actionType" value="revert_to_pending" />
                    <button
                      type="submit"
                      className="px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                    >
                      ยกเลิกการตัดสินใจ
                    </button>
                  </form>

                  {request.status === BindingRequestStatus.APPROVED && (
                    <form action={revertOrUpdateBindingAction} style={{ display: "contents" }}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="actionType" value="change_decision" />
                      <input type="hidden" name="newStatus" value="REJECTED" />
                      <button
                        type="submit"
                        className="px-3 py-1 text-xs font-medium bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        เปลี่ยนเป็นปฏิเสธ
                      </button>
                    </form>
                  )}

                  {request.status === BindingRequestStatus.REJECTED && (
                    <form action={revertOrUpdateBindingAction} style={{ display: "contents" }}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="actionType" value="change_decision" />
                      <input type="hidden" name="newStatus" value="APPROVED" />
                      <button
                        type="submit"
                        className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded hover:bg-green-200"
                      >
                        เปลี่ยนเป็นอนุมัติ
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

async function getBindingRequestHistory(isSuperAdmin: boolean, villageIds: string[], keyword: string) {
  if (!isSuperAdmin && villageIds.length === 0) {
    return [] as Array<{
      id: string;
      houseNumber: string | null;
      note: string | null;
      status: BindingRequestStatus;
      houseId: string | null;
      reviewedBy: string | null;
      reviewedAt: Date | null;
      reviewNote: string | null;
      user: { name: string; phoneNumber: string };
      village: { name: string | null } | null;
      house: { houseNumber: string } | null;
    }>;
  }

  const where: Prisma.BindingRequestWhereInput = {
    status: { in: [BindingRequestStatus.APPROVED, BindingRequestStatus.REJECTED] },
  };
  if (!isSuperAdmin) {
    where.villageId = { in: villageIds };
  }
  if (keyword) {
    where.OR = [
      { user: { is: { name: { contains: keyword, mode: "insensitive" } } } },
      { user: { is: { phoneNumber: { contains: keyword, mode: "insensitive" } } } },
      { houseNumber: { contains: keyword, mode: "insensitive" } },
      { house: { is: { houseNumber: { contains: keyword, mode: "insensitive" } } } },
    ];
  }

  return prisma.bindingRequest.findMany({
    where,
    orderBy: { reviewedAt: "desc" },
    distinct: ["userId"],
    include: {
      user: { select: { name: true, phoneNumber: true } },
      village: { select: { name: true } },
      house: { select: { houseNumber: true } },
    },
  });
}
