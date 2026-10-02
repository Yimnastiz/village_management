import {
  AuditAction,
  HouseAccountOpeningRequestStatus,
  MembershipStatus,
  NotificationType,
  Prisma,
  VillageMembershipRole,
} from "@prisma/client";
import {
  AccountEmailServiceError,
  activateAccountEmailInTransaction,
  releaseOpeningRequestEmailInTransaction,
} from "@/lib/account-email-service";
import { maskEmail } from "@/lib/account-email";
import { getConfiguredVillage } from "@/lib/configured-village";
import { getEmailProvider } from "@/lib/email/email-provider";
import type { EmailProvider as DeliveryProvider } from "@/lib/email/email-provider-contract";
import {
  buildHouseAccountActivationData,
  normalizeOpeningRejectionReason,
  openingReviewEligibility,
} from "@/lib/house-account-opening-review-policy";
import { maskPhone } from "@/lib/mask-phone";
import { notificationMetadata } from "@/lib/notification-copy";
import { prisma } from "@/lib/prisma";

export type HouseAccountOpeningReviewErrorCode =
  | "FORBIDDEN"
  | "REQUEST_NOT_FOUND"
  | "REQUEST_ALREADY_PROCESSED"
  | "REQUEST_NOT_REVIEWABLE"
  | "REJECTION_REASON_REQUIRED"
  | "WRONG_VILLAGE"
  | "EMAIL_NOT_VERIFIED"
  | "EMAIL_UNAVAILABLE"
  | "HOUSE_ALREADY_ACTIVE"
  | "ACTIVATION_CONFLICT";

export class HouseAccountOpeningReviewError extends Error {
  constructor(readonly code: HouseAccountOpeningReviewErrorCode, message: string) {
    super(message);
    this.name = "HouseAccountOpeningReviewError";
  }
}

export function houseAccountOpeningReviewErrorMessage(code: HouseAccountOpeningReviewErrorCode) {
  switch (code) {
    case "FORBIDDEN": return "คุณไม่มีสิทธิ์ตรวจสอบคำขอนี้";
    case "REQUEST_NOT_FOUND": return "ไม่พบคำขอเปิดบัญชีบ้าน";
    case "REQUEST_ALREADY_PROCESSED": return "คำขอนี้ได้รับการดำเนินการแล้ว";
    case "REQUEST_NOT_REVIEWABLE": return "คำขอนี้ไม่อยู่ในสถานะรอตรวจสอบ";
    case "REJECTION_REASON_REQUIRED": return "กรุณาระบุเหตุผลในการปฏิเสธ";
    case "WRONG_VILLAGE": return "คำขอนี้ไม่อยู่ในหมู่บ้านที่กำหนด";
    case "EMAIL_NOT_VERIFIED": return "อีเมลของคำขอนี้ยังไม่ผ่านการยืนยัน";
    case "EMAIL_UNAVAILABLE": return "อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว";
    case "HOUSE_ALREADY_ACTIVE": return "บ้านเลขที่นี้มีบัญชีบ้านแล้ว";
    case "ACTIVATION_CONFLICT": return "ไม่สามารถเปิดบัญชีบ้านได้ เนื่องจากข้อมูลมีการเปลี่ยนแปลง กรุณารีเฟรชแล้วลองใหม่";
  }
}

const historyStatuses = [
  HouseAccountOpeningRequestStatus.APPROVED,
  HouseAccountOpeningRequestStatus.REJECTED,
  HouseAccountOpeningRequestStatus.CANCELLED,
  HouseAccountOpeningRequestStatus.EXPIRED,
] as const;

async function requireActiveConfiguredHeadman(actorUserId: string) {
  const village = await getConfiguredVillage();
  const membership = await prisma.villageMembership.findFirst({
    where: {
      userId: actorUserId,
      villageId: village.id,
      role: VillageMembershipRole.HEADMAN,
      status: MembershipStatus.ACTIVE,
    },
    select: { id: true },
  });
  if (!membership) {
    throw new HouseAccountOpeningReviewError("FORBIDDEN", houseAccountOpeningReviewErrorMessage("FORBIDDEN"));
  }
  return village;
}

async function assertHeadmanInTransaction(tx: Prisma.TransactionClient, actorUserId: string, villageId: string) {
  const [village, membership] = await Promise.all([
    tx.village.findUnique({ where: { id: villageId }, select: { isActive: true } }),
    tx.villageMembership.findFirst({
    where: {
      userId: actorUserId,
      villageId,
      role: VillageMembershipRole.HEADMAN,
      status: MembershipStatus.ACTIVE,
    },
    select: { id: true },
    }),
  ]);
  if (!village?.isActive || !membership) {
    throw new HouseAccountOpeningReviewError("FORBIDDEN", houseAccountOpeningReviewErrorMessage("FORBIDDEN"));
  }
}

export async function getOpeningRequestsForHeadman(
  actorUserId: string,
  options: {
    tab?: "pending" | "history";
    query?: string;
    historyStatus?: (typeof historyStatuses)[number];
    page?: number;
    pageSize?: number;
  } = {},
) {
  const village = await requireActiveConfiguredHeadman(actorUserId);
  const tab = options.tab === "history" ? "history" : "pending";
  const query = options.query?.trim() ?? "";
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));
  const status = tab === "pending"
    ? HouseAccountOpeningRequestStatus.PENDING_REVIEW
    : options.historyStatus ?? { in: [...historyStatuses] };
  const where: Prisma.HouseAccountOpeningRequestWhereInput = {
    villageId: village.id,
    status,
    ...(query ? {
      OR: [
        { house: { is: { houseNumber: { contains: query, mode: "insensitive" } } } },
        { applicantFirstName: { contains: query, mode: "insensitive" } },
        { applicantLastName: { contains: query, mode: "insensitive" } },
        { contactPhone: { contains: query } },
      ],
    } : {}),
  };
  const [pendingCount, total, rows] = await Promise.all([
    prisma.houseAccountOpeningRequest.count({
      where: { villageId: village.id, status: HouseAccountOpeningRequestStatus.PENDING_REVIEW },
    }),
    prisma.houseAccountOpeningRequest.count({ where }),
    prisma.houseAccountOpeningRequest.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: tab === "pending" ? { requestedAt: "asc" } : { updatedAt: "desc" },
      include: {
        house: { select: { houseNumber: true } },
        initialEmail: { select: { email: true } },
      },
    }),
  ]);
  return {
    pendingCount,
    total,
    page,
    pageSize,
    requests: rows.map((request) => ({
      id: request.id,
      houseNumber: request.house.houseNumber,
      applicantName: `${request.applicantFirstName} ${request.applicantLastName}`.trim(),
      maskedPhone: maskPhone(request.contactPhone),
      contactPhone: request.contactPhone,
      maskedEmail: maskEmail(request.initialEmail?.email ?? request.emailSnapshot),
      requestedAt: request.requestedAt,
      reviewedAt: request.reviewedAt ?? request.updatedAt,
      status: request.status,
    })),
  };
}

export async function getOpeningRequestForHeadman(actorUserId: string, requestId: string) {
  const village = await requireActiveConfiguredHeadman(actorUserId);
  const request = await prisma.houseAccountOpeningRequest.findFirst({
    where: { id: requestId, villageId: village.id },
    include: {
      village: { select: { name: true, moo: true } },
      house: {
        select: {
          id: true,
          villageId: true,
          houseNumber: true,
          occupancyStatus: true,
          _count: { select: { persons: true } },
          residentHouseAccount: { select: { id: true, userId: true } },
        },
      },
      initialEmail: { select: { id: true, email: true, status: true, verifiedAt: true } },
      reviewedBy: { select: { name: true } },
      activatedUser: {
        select: {
          id: true,
          name: true,
          email: true,
          residentHouseAccount: { select: { id: true, activatedAt: true } },
        },
      },
    },
  });
  if (!request) {
    throw new HouseAccountOpeningReviewError("REQUEST_NOT_FOUND", houseAccountOpeningReviewErrorMessage("REQUEST_NOT_FOUND"));
  }
  return request;
}

type DecisionEmail = {
  requestId: string;
  decision: "APPROVED" | "REJECTED";
  to: string;
  houseNumber: string;
  rejectionReason?: string;
};

export async function deliverOpeningDecisionEmailSafely(
  input: DecisionEmail,
  provider?: DeliveryProvider,
): Promise<boolean> {
  const approved = input.decision === "APPROVED";
  const subject = approved ? "บัญชีบ้านได้รับการอนุมัติแล้ว" : "ผลการตรวจสอบคำขอเปิดบัญชีบ้าน";
  const text = approved
    ? `คำขอเปิดบัญชีบ้านเลขที่ ${input.houseNumber} ได้รับการอนุมัติแล้ว\n\nบัญชีบ้านเปิดใช้งานแล้ว คุณสามารถเข้าสู่ระบบด้วยอีเมลที่ยืนยันไว้และรหัสยืนยันทางอีเมล`
    : `คำขอเปิดบัญชีบ้านเลขที่ ${input.houseNumber} ไม่ได้รับการอนุมัติ\n\nเหตุผล:\n${input.rejectionReason ?? "ไม่ระบุเหตุผล"}\n\nหากต้องการสอบถามเพิ่มเติม กรุณาติดต่อผู้ใหญ่บ้าน`;
  try {
    const deliveryProvider = provider ?? getEmailProvider();
    await deliveryProvider.sendMessage({ to: input.to, subject, text });
    return true;
  } catch (error) {
    console.error("[house-account-opening] decision email delivery failed", {
      requestId: input.requestId,
      decision: input.decision,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return false;
  }
}

export async function rejectHouseAccountOpeningRequest(
  actorUserId: string,
  requestId: string,
  reasonInput: unknown,
  dependencies: { emailProvider?: DeliveryProvider } = {},
) {
  const reason = normalizeOpeningRejectionReason(reasonInput);
  if (!reason) {
    throw new HouseAccountOpeningReviewError(
      "REJECTION_REASON_REQUIRED",
      houseAccountOpeningReviewErrorMessage("REJECTION_REASON_REQUIRED"),
    );
  }
  const configuredVillage = await getConfiguredVillage();
  const decision = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`house-opening-review:${requestId}`}))`;
    await assertHeadmanInTransaction(tx, actorUserId, configuredVillage.id);
    const request = await tx.houseAccountOpeningRequest.findUnique({
      where: { id: requestId },
      include: {
        house: { select: { villageId: true, houseNumber: true } },
        initialEmail: true,
      },
    });
    if (!request) {
      throw new HouseAccountOpeningReviewError("REQUEST_NOT_FOUND", houseAccountOpeningReviewErrorMessage("REQUEST_NOT_FOUND"));
    }
    if (request.villageId !== configuredVillage.id || request.house.villageId !== configuredVillage.id) {
      throw new HouseAccountOpeningReviewError("WRONG_VILLAGE", houseAccountOpeningReviewErrorMessage("WRONG_VILLAGE"));
    }
    if (request.status === HouseAccountOpeningRequestStatus.REJECTED) {
      return { outcome: "ALREADY_REJECTED" as const, email: request.initialEmail?.email ?? request.emailSnapshot, houseNumber: request.house.houseNumber };
    }
    if (request.status !== HouseAccountOpeningRequestStatus.PENDING_REVIEW) {
      throw new HouseAccountOpeningReviewError("REQUEST_ALREADY_PROCESSED", houseAccountOpeningReviewErrorMessage("REQUEST_ALREADY_PROCESSED"));
    }
    if (!request.initialEmail) {
      throw new HouseAccountOpeningReviewError("EMAIL_NOT_VERIFIED", houseAccountOpeningReviewErrorMessage("EMAIL_NOT_VERIFIED"));
    }
    const reviewedAt = new Date();
    const updated = await tx.houseAccountOpeningRequest.updateMany({
      where: { id: request.id, status: HouseAccountOpeningRequestStatus.PENDING_REVIEW },
      data: {
        status: HouseAccountOpeningRequestStatus.REJECTED,
        reviewedAt,
        reviewedByUserId: actorUserId,
        rejectionReason: reason,
      },
    });
    if (updated.count !== 1) {
      throw new HouseAccountOpeningReviewError("REQUEST_ALREADY_PROCESSED", houseAccountOpeningReviewErrorMessage("REQUEST_ALREADY_PROCESSED"));
    }
    await tx.emailOtpChallenge.updateMany({
      where: {
        accountEmailId: request.initialEmail.id,
        purpose: "HOUSE_OPENING",
        status: { in: ["PENDING_DELIVERY", "ACTIVE", "VERIFIED"] },
      },
      data: { status: "CANCELLED" },
    });
    await releaseOpeningRequestEmailInTransaction(tx, request.id, reviewedAt);
    await tx.auditLog.create({
      data: {
        userId: actorUserId,
        villageId: configuredVillage.id,
        action: AuditAction.REJECT,
        resource: "HouseAccountOpeningRequest",
        resourceId: request.id,
        metadata: {
          actorRole: "HEADMAN",
          actionName: "HOUSE_ACCOUNT_OPENING_REJECTED",
          houseId: request.houseId,
          houseNumber: request.house.houseNumber,
        },
      },
    });
    return { outcome: "REJECTED" as const, email: request.initialEmail.email, houseNumber: request.house.houseNumber };
  });
  const emailDelivered = decision.outcome === "REJECTED"
    ? await deliverOpeningDecisionEmailSafely({
        requestId,
        decision: "REJECTED",
        to: decision.email,
        houseNumber: decision.houseNumber,
        rejectionReason: reason,
      }, dependencies.emailProvider)
    : false;
  return { ...decision, emailDelivered };
}

export async function approveAndActivateHouseAccount(
  actorUserId: string,
  requestId: string,
  dependencies: { emailProvider?: DeliveryProvider } = {},
) {
  const configuredVillage = await getConfiguredVillage();
  let decision;
  try {
    decision = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`house-opening-review:${requestId}`}))`;
      await assertHeadmanInTransaction(tx, actorUserId, configuredVillage.id);
      const requestPointer = await tx.houseAccountOpeningRequest.findUnique({
        where: { id: requestId },
        select: { houseId: true },
      });
      if (!requestPointer) {
        throw new HouseAccountOpeningReviewError("REQUEST_NOT_FOUND", houseAccountOpeningReviewErrorMessage("REQUEST_NOT_FOUND"));
      }
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`house-account-opening:${requestPointer.houseId}`}))`;
      const request = await tx.houseAccountOpeningRequest.findUnique({
        where: { id: requestId },
        include: {
          house: {
            select: {
              id: true,
              villageId: true,
              houseNumber: true,
              residentHouseAccount: { select: { id: true } },
            },
          },
          initialEmail: true,
        },
      });
      if (!request) {
        throw new HouseAccountOpeningReviewError("REQUEST_NOT_FOUND", houseAccountOpeningReviewErrorMessage("REQUEST_NOT_FOUND"));
      }
      const eligibility = openingReviewEligibility({
        requestStatus: request.status,
        requestVillageId: request.villageId,
        houseVillageId: request.house.villageId,
        configuredVillageId: configuredVillage.id,
        accountEmailStatus: request.initialEmail?.status ?? null,
        accountEmailVerifiedAt: request.initialEmail?.verifiedAt ?? null,
        hasResidentHouseAccount: Boolean(request.house.residentHouseAccount),
        activatedUserId: request.activatedUserId,
      });
      if (eligibility === "ALREADY_APPROVED" && request.activatedUserId && request.initialEmail) {
        return {
          outcome: "ALREADY_APPROVED" as const,
          userId: request.activatedUserId,
          email: request.initialEmail.email,
          houseNumber: request.house.houseNumber,
        };
      }
      if (eligibility !== "ELIGIBLE" || !request.initialEmail) {
        const code: HouseAccountOpeningReviewErrorCode = eligibility === "WRONG_VILLAGE"
          ? "WRONG_VILLAGE"
          : eligibility === "EMAIL_NOT_VERIFIED"
            ? "EMAIL_NOT_VERIFIED"
            : eligibility === "HOUSE_ALREADY_ACTIVE"
              ? "HOUSE_ALREADY_ACTIVE"
              : eligibility === "ALREADY_APPROVED" || eligibility === "ALREADY_REJECTED" || eligibility === "ALREADY_ACTIVATED"
                ? "REQUEST_ALREADY_PROCESSED"
                : "REQUEST_NOT_REVIEWABLE";
        throw new HouseAccountOpeningReviewError(code, houseAccountOpeningReviewErrorMessage(code));
      }
      const existingCanonicalEmail = await tx.user.findFirst({
        where: { email: { equals: request.initialEmail.email, mode: "insensitive" } },
        select: { id: true },
      });
      if (existingCanonicalEmail) {
        throw new HouseAccountOpeningReviewError("EMAIL_UNAVAILABLE", houseAccountOpeningReviewErrorMessage("EMAIL_UNAVAILABLE"));
      }
      const activatedAt = new Date();
      const activation = buildHouseAccountActivationData({
        villageId: configuredVillage.id,
        houseId: request.houseId,
        houseNumber: request.house.houseNumber,
        contactPhone: request.contactPhone,
        verifiedEmail: request.initialEmail.email,
        activatedAt,
      });
      const user = await tx.user.create({ data: activation.user });
      const houseAccount = await tx.residentHouseAccount.create({
        data: { ...activation.residentHouseAccount, userId: user.id },
      });
      await tx.villageMembership.create({
        data: { ...activation.membership, userId: user.id },
      });
      await activateAccountEmailInTransaction(tx, {
        accountEmailId: request.initialEmail.id,
        userId: user.id,
        residentHouseAccountId: houseAccount.id,
        activatedAt,
      });
      const approved = await tx.houseAccountOpeningRequest.updateMany({
        where: {
          id: request.id,
          status: HouseAccountOpeningRequestStatus.PENDING_REVIEW,
          activatedUserId: null,
        },
        data: {
          status: HouseAccountOpeningRequestStatus.APPROVED,
          reviewedAt: activatedAt,
          reviewedByUserId: actorUserId,
          activatedUserId: user.id,
          rejectionReason: null,
        },
      });
      if (approved.count !== 1) {
        throw new HouseAccountOpeningReviewError("REQUEST_ALREADY_PROCESSED", houseAccountOpeningReviewErrorMessage("REQUEST_ALREADY_PROCESSED"));
      }
      await tx.notification.create({
        data: {
          userId: user.id,
          villageId: configuredVillage.id,
          type: NotificationType.SYSTEM,
          title: "บัญชีบ้านได้รับการอนุมัติแล้ว",
          body: `บัญชีบ้านเลขที่ ${request.house.houseNumber} เปิดใช้งานแล้ว`,
          metadata: notificationMetadata("HOUSEHOLD", {
            action: "HOUSE_ACCOUNT_OPENING_APPROVED",
            openingRequestId: request.id,
          }),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actorUserId,
          villageId: configuredVillage.id,
          action: AuditAction.APPROVE,
          resource: "HouseAccountOpeningRequest",
          resourceId: request.id,
          metadata: {
            actorRole: "HEADMAN",
            actionName: "HOUSE_ACCOUNT_OPENING_APPROVED",
            houseId: request.houseId,
            houseNumber: request.house.houseNumber,
            activatedUserId: user.id,
          },
        },
      });
      return {
        outcome: "ACTIVATED" as const,
        userId: user.id,
        email: request.initialEmail.email,
        houseNumber: request.house.houseNumber,
      };
    });
  } catch (error) {
    if (error instanceof HouseAccountOpeningReviewError) throw error;
    if (error instanceof AccountEmailServiceError) {
      throw new HouseAccountOpeningReviewError("EMAIL_NOT_VERIFIED", houseAccountOpeningReviewErrorMessage("EMAIL_NOT_VERIFIED"));
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HouseAccountOpeningReviewError("ACTIVATION_CONFLICT", houseAccountOpeningReviewErrorMessage("ACTIVATION_CONFLICT"));
    }
    throw error;
  }
  const emailDelivered = decision.outcome === "ACTIVATED"
    ? await deliverOpeningDecisionEmailSafely({
        requestId,
        decision: "APPROVED",
        to: decision.email,
        houseNumber: decision.houseNumber,
      }, dependencies.emailProvider)
    : false;
  return { ...decision, emailDelivered };
}

export { historyStatuses as HOUSE_ACCOUNT_OPENING_HISTORY_STATUSES };
