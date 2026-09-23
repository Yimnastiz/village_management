import {
  AuditAction,
  MembershipStatus,
  NotificationType,
  Prisma,
  VillageMembershipRole,
} from "@prisma/client";
import {
  AccountEmailServiceError,
  markOpeningRequestEmailVerifiedInTransaction,
  releaseOpeningRequestEmailInTransaction,
  reserveEmailForOpeningRequestInTransaction,
} from "@/lib/account-email-service";
import { maskEmail } from "@/lib/account-email";
import { getConfiguredVillage } from "@/lib/configured-village";
import {
  consumeVerifiedEmailOtpChallenge,
  EmailOtpServiceError,
  issueEmailOtpChallenge,
  resendEmailOtpChallenge,
  verifyEmailOtpChallenge,
  type EmailOtpClientContext,
} from "@/lib/email/email-otp-service";
import {
  canApplicantCancelOpeningRequest,
  houseOpeningEligibility,
  LIVE_HOUSE_OPENING_STATUSES,
  validateHouseAccountOpeningInput,
  type HouseAccountOpeningInput,
  type HouseAccountOpeningValidationError,
} from "@/lib/house-account-opening-policy";
import { normalizeHouseNumber } from "@/lib/house-number";
import { notificationMetadata } from "@/lib/notification-copy";
import { prisma } from "@/lib/prisma";
import { getSystemSettings } from "@/lib/system-settings";

export type HouseAccountOpeningErrorCode =
  | "INVALID_INPUT"
  | "REGISTRATION_DISABLED"
  | "MAINTENANCE_MODE"
  | "HOUSE_NOT_FOUND"
  | "HOUSE_ALREADY_ACTIVE"
  | "HOUSE_REQUEST_ALREADY_PENDING"
  | "EMAIL_UNAVAILABLE"
  | "REQUEST_NOT_FOUND"
  | "REQUEST_NOT_EDITABLE"
  | "CHALLENGE_MISMATCH"
  | "OTP_INVALID"
  | "OTP_EXPIRED"
  | "OTP_LOCKED"
  | "OTP_UNAVAILABLE"
  | "RESEND_COOLDOWN"
  | "RATE_LIMITED"
  | "DELIVERY_FAILED";

export class HouseAccountOpeningError extends Error {
  constructor(
    readonly code: HouseAccountOpeningErrorCode,
    message: string,
    readonly validationErrors: HouseAccountOpeningValidationError[] = [],
  ) {
    super(message);
    this.name = "HouseAccountOpeningError";
  }
}

export function houseAccountOpeningErrorMessage(code: HouseAccountOpeningErrorCode): string {
  switch (code) {
    case "REGISTRATION_DISABLED": return "ขณะนี้ปิดรับคำขอเปิดบัญชีบ้านชั่วคราว";
    case "MAINTENANCE_MODE": return "ระบบอยู่ระหว่างการปรับปรุง กรุณาลองใหม่ภายหลัง";
    case "HOUSE_NOT_FOUND": return "ไม่พบบ้านเลขที่นี้ กรุณาติดต่อผู้ใหญ่บ้าน";
    case "HOUSE_ALREADY_ACTIVE": return "บ้านเลขที่นี้มีบัญชีบ้านแล้ว";
    case "HOUSE_REQUEST_ALREADY_PENDING": return "บ้านเลขที่นี้มีคำขอเปิดบัญชีที่กำลังดำเนินการอยู่";
    case "EMAIL_UNAVAILABLE": return "อีเมลนี้ไม่สามารถใช้สำหรับเปิดบัญชีบ้านได้";
    case "REQUEST_NOT_FOUND": return "ไม่พบคำขอเปิดบัญชีบ้าน หรือสิทธิ์เข้าถึงหมดอายุแล้ว";
    case "REQUEST_NOT_EDITABLE": return "คำขอนี้ไม่อยู่ในสถานะที่ดำเนินการต่อได้";
    case "CHALLENGE_MISMATCH": return "รหัสยืนยันนี้ไม่ตรงกับคำขอเปิดบัญชีบ้าน";
    case "OTP_INVALID": return "รหัสยืนยันไม่ถูกต้อง";
    case "OTP_EXPIRED": return "รหัสยืนยันหมดอายุแล้ว กรุณาขอรหัสใหม่";
    case "OTP_LOCKED": return "กรอกรหัสไม่ถูกต้องเกินจำนวนครั้งที่กำหนด กรุณาเริ่มคำขอใหม่";
    case "OTP_UNAVAILABLE": return "รหัสยืนยันนี้ไม่สามารถใช้งานได้";
    case "RESEND_COOLDOWN": return "กรุณารอก่อนส่งรหัสยืนยันอีกครั้ง";
    case "RATE_LIMITED": return "ส่งคำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่";
    case "DELIVERY_FAILED": return "ไม่สามารถส่งอีเมลยืนยันได้ กรุณาลองใหม่ภายหลัง";
    default: return "กรุณาตรวจสอบข้อมูลที่กรอก";
  }
}

async function assertOpeningAvailable(): Promise<void> {
  const settings = await getSystemSettings();
  if (!settings.registrationEnabled) {
    throw new HouseAccountOpeningError("REGISTRATION_DISABLED", houseAccountOpeningErrorMessage("REGISTRATION_DISABLED"));
  }
  if (settings.maintenanceMode) {
    throw new HouseAccountOpeningError("MAINTENANCE_MODE", houseAccountOpeningErrorMessage("MAINTENANCE_MODE"));
  }
}

function mapEmailOtpError(error: EmailOtpServiceError): HouseAccountOpeningError {
  const mapped: HouseAccountOpeningErrorCode =
    error.code === "INVALID_CODE" ? "OTP_INVALID"
      : error.code === "CHALLENGE_EXPIRED" ? "OTP_EXPIRED"
        : error.code === "CHALLENGE_LOCKED" ? "OTP_LOCKED"
          : error.code === "RESEND_COOLDOWN" ? "RESEND_COOLDOWN"
            : error.code === "MAX_RESENDS" || error.code === "RATE_LIMITED" ? "RATE_LIMITED"
              : error.code === "DELIVERY_FAILED" ? "DELIVERY_FAILED"
                : "OTP_UNAVAILABLE";
  return new HouseAccountOpeningError(mapped, houseAccountOpeningErrorMessage(mapped));
}

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function searchConfiguredVillageHouses(query: string): Promise<Array<{
  houseId: string;
  houseNumber: string;
}>> {
  const village = await getConfiguredVillage();
  const normalizedQuery = normalizeHouseNumber(query);
  if (!normalizedQuery || normalizedQuery.length > 50) return [];

  const houses = await prisma.house.findMany({
    where: {
      villageId: village.id,
      normalizedHouseNumber: normalizedQuery.length === 1
        ? { equals: normalizedQuery }
        : { startsWith: normalizedQuery },
    },
    select: { id: true, houseNumber: true },
    orderBy: { normalizedHouseNumber: "asc" },
    take: 6,
  });
  return houses.map((house) => ({ houseId: house.id, houseNumber: house.houseNumber }));
}

export async function startHouseAccountOpening(
  input: HouseAccountOpeningInput,
  context: EmailOtpClientContext = {},
): Promise<{
  requestId: string;
  challengeId: string;
  maskedEmail: string;
  houseNumber: string;
  expiresAt: Date;
  resendAvailableAt: Date;
}> {
  await assertOpeningAvailable();
  const validated = validateHouseAccountOpeningInput(input);
  if (!validated.success) {
    throw new HouseAccountOpeningError(
      "INVALID_INPUT",
      houseAccountOpeningErrorMessage("INVALID_INPUT"),
      validated.errors,
    );
  }
  const village = await getConfiguredVillage();
  let created: { requestId: string; accountEmailId: string; email: string; houseNumber: string };

  try {
    created = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`house-account-opening:${validated.value.houseId}`}))`;
      const house = await tx.house.findUnique({
        where: { id: validated.value.houseId },
        select: {
          id: true,
          villageId: true,
          houseNumber: true,
          residentHouseAccount: { select: { id: true } },
          houseAccountOpeningRequests: {
            where: { status: { in: [...LIVE_HOUSE_OPENING_STATUSES] } },
            select: { id: true },
            take: 1,
          },
        },
      });
      const eligibility = houseOpeningEligibility({
        houseExists: Boolean(house),
        houseVillageId: house?.villageId ?? null,
        configuredVillageId: village.id,
        hasResidentHouseAccount: Boolean(house?.residentHouseAccount),
        hasLiveOpeningRequest: Boolean(house?.houseAccountOpeningRequests.length),
      });
      if (eligibility !== "ELIGIBLE") {
        const code: HouseAccountOpeningErrorCode = eligibility === "HOUSE_ALREADY_ACTIVE"
          ? "HOUSE_ALREADY_ACTIVE"
          : eligibility === "HOUSE_REQUEST_ALREADY_PENDING"
            ? "HOUSE_REQUEST_ALREADY_PENDING"
            : "HOUSE_NOT_FOUND";
        throw new HouseAccountOpeningError(code, houseAccountOpeningErrorMessage(code));
      }

      const openingRequest = await tx.houseAccountOpeningRequest.create({
        data: {
          villageId: village.id,
          houseId: house!.id,
          applicantFirstName: validated.value.applicantFirstName,
          applicantLastName: validated.value.applicantLastName,
          contactPhone: validated.value.contactPhone,
          emailSnapshot: validated.value.email,
          normalizedEmailSnapshot: validated.value.normalizedEmail,
          status: "PENDING_EMAIL_VERIFICATION",
        },
      });
      const accountEmail = await reserveEmailForOpeningRequestInTransaction(tx, {
        openingRequestId: openingRequest.id,
        email: validated.value.email,
      });
      return {
        requestId: openingRequest.id,
        accountEmailId: accountEmail.id,
        email: accountEmail.email,
        houseNumber: house!.houseNumber,
      };
    });
  } catch (error) {
    if (error instanceof HouseAccountOpeningError) throw error;
    if (error instanceof AccountEmailServiceError) {
      const code: HouseAccountOpeningErrorCode = error.code === "EMAIL_ALREADY_RESERVED"
        ? "EMAIL_UNAVAILABLE"
        : "INVALID_INPUT";
      throw new HouseAccountOpeningError(code, houseAccountOpeningErrorMessage(code));
    }
    if (isUniqueConstraintError(error)) {
      const target = JSON.stringify(error.meta?.target ?? "");
      const code: HouseAccountOpeningErrorCode = target.includes("normalizedEmail")
        ? "EMAIL_UNAVAILABLE"
        : "HOUSE_REQUEST_ALREADY_PENDING";
      throw new HouseAccountOpeningError(code, houseAccountOpeningErrorMessage(code));
    }
    throw error;
  }

  try {
    const challenge = await issueEmailOtpChallenge({
      email: created.email,
      purpose: "HOUSE_OPENING",
      accountEmailId: created.accountEmailId,
      context,
    });
    return {
      requestId: created.requestId,
      challengeId: challenge.challengeId,
      maskedEmail: maskEmail(created.email),
      houseNumber: created.houseNumber,
      expiresAt: challenge.expiresAt,
      resendAvailableAt: challenge.resendAvailableAt,
    };
  } catch (error) {
    await cancelHouseAccountOpeningInternal(created.requestId, new Date());
    if (error instanceof EmailOtpServiceError) throw mapEmailOtpError(error);
    throw error;
  }
}

async function requestAndChallenge(requestId: string, challengeId: string) {
  const openingRequest = await prisma.houseAccountOpeningRequest.findUnique({
    where: { id: requestId },
    include: {
      initialEmail: true,
      house: { select: { houseNumber: true } },
    },
  });
  const challenge = await prisma.emailOtpChallenge.findUnique({
    where: { id: challengeId },
    select: {
      id: true,
      purpose: true,
      accountEmailId: true,
      normalizedEmail: true,
      status: true,
      expiresAt: true,
      resendAvailableAt: true,
    },
  });
  if (!openingRequest) {
    throw new HouseAccountOpeningError("REQUEST_NOT_FOUND", houseAccountOpeningErrorMessage("REQUEST_NOT_FOUND"));
  }
  if (
    !openingRequest.initialEmail
    || !challenge
    || challenge.purpose !== "HOUSE_OPENING"
    || challenge.accountEmailId !== openingRequest.initialEmail.id
    || challenge.normalizedEmail !== openingRequest.initialEmail.normalizedEmail
  ) {
    throw new HouseAccountOpeningError("CHALLENGE_MISMATCH", houseAccountOpeningErrorMessage("CHALLENGE_MISMATCH"));
  }
  return { openingRequest, challenge };
}

export async function resendHouseAccountOpeningOtp(
  requestId: string,
  challengeId: string,
  context: EmailOtpClientContext = {},
) {
  await assertOpeningAvailable();
  const { openingRequest, challenge } = await requestAndChallenge(requestId, challengeId);
  if (openingRequest.status !== "PENDING_EMAIL_VERIFICATION") {
    throw new HouseAccountOpeningError("REQUEST_NOT_EDITABLE", houseAccountOpeningErrorMessage("REQUEST_NOT_EDITABLE"));
  }
  try {
    const resent = await resendEmailOtpChallenge({
      challengeId: challenge.id,
      email: openingRequest.initialEmail!.email,
      context,
    });
    return {
      challengeId: resent.challengeId,
      maskedEmail: maskEmail(openingRequest.initialEmail!.email),
      expiresAt: resent.expiresAt,
      resendAvailableAt: resent.resendAvailableAt,
    };
  } catch (error) {
    if (error instanceof EmailOtpServiceError) throw mapEmailOtpError(error);
    throw error;
  }
}

export async function verifyHouseAccountOpeningEmail(
  requestId: string,
  challengeId: string,
  code: string,
): Promise<{
  houseNumber: string;
  applicantName: string;
  contactPhone: string;
  maskedEmail: string;
  requestedAt: Date;
}> {
  await assertOpeningAvailable();
  const initial = await requestAndChallenge(requestId, challengeId);
  if (initial.openingRequest.status !== "PENDING_EMAIL_VERIFICATION") {
    throw new HouseAccountOpeningError("REQUEST_NOT_EDITABLE", houseAccountOpeningErrorMessage("REQUEST_NOT_EDITABLE"));
  }

  try {
    await verifyEmailOtpChallenge({ challengeId, code });
    const result = await consumeVerifiedEmailOtpChallenge(challengeId, {
      apply: async (tx, verifiedChallenge) => {
        const current = await tx.houseAccountOpeningRequest.findUnique({
          where: { id: requestId },
          include: {
            initialEmail: true,
            house: { select: { houseNumber: true, residentHouseAccount: { select: { id: true } } } },
          },
        });
        if (!current) {
          throw new HouseAccountOpeningError("REQUEST_NOT_FOUND", houseAccountOpeningErrorMessage("REQUEST_NOT_FOUND"));
        }
        if (current.status !== "PENDING_EMAIL_VERIFICATION" || current.house.residentHouseAccount) {
          throw new HouseAccountOpeningError("REQUEST_NOT_EDITABLE", houseAccountOpeningErrorMessage("REQUEST_NOT_EDITABLE"));
        }
        if (
          verifiedChallenge.purpose !== "HOUSE_OPENING"
          || !current.initialEmail
          || verifiedChallenge.accountEmailId !== current.initialEmail.id
          || verifiedChallenge.normalizedEmail !== current.initialEmail.normalizedEmail
        ) {
          throw new HouseAccountOpeningError("CHALLENGE_MISMATCH", houseAccountOpeningErrorMessage("CHALLENGE_MISMATCH"));
        }

        const requestedAt = new Date();
        await markOpeningRequestEmailVerifiedInTransaction(tx, {
          openingRequestId: current.id,
          accountEmailId: current.initialEmail.id,
          verifiedAt: verifiedChallenge.verifiedAt,
        });
        await tx.houseAccountOpeningRequest.update({
          where: { id: current.id },
          data: { status: "PENDING_REVIEW", requestedAt },
        });

        const headmen = await tx.villageMembership.findMany({
          where: {
            villageId: current.villageId,
            role: VillageMembershipRole.HEADMAN,
            status: MembershipStatus.ACTIVE,
          },
          select: { userId: true },
          distinct: ["userId"],
        });
        if (headmen.length) {
          await tx.notification.createMany({
            data: headmen.map(({ userId }) => ({
              userId,
              villageId: current.villageId,
              type: NotificationType.SYSTEM,
              title: "มีคำขอเปิดบัญชีบ้านใหม่",
              body: `บ้านเลขที่ ${current.house.houseNumber} ส่งคำขอเปิดบัญชีและรอการตรวจสอบ`,
              metadata: notificationMetadata("HOUSEHOLD", {
                action: "HOUSE_ACCOUNT_OPENING_REQUEST_SUBMITTED",
                openingRequestId: current.id,
              }),
            })),
          });
        }
        await tx.auditLog.create({
          data: {
            userId: null,
            villageId: current.villageId,
            action: AuditAction.CREATE,
            resource: "HouseAccountOpeningRequest",
            resourceId: current.id,
            metadata: {
              actorRole: "PUBLIC",
              actionName: "HOUSE_ACCOUNT_OPENING_REQUEST_SUBMITTED",
              houseId: current.houseId,
              houseNumber: current.house.houseNumber,
            },
          },
        });
        return {
          houseNumber: current.house.houseNumber,
          applicantName: `${current.applicantFirstName} ${current.applicantLastName}`,
          contactPhone: current.contactPhone,
          maskedEmail: maskEmail(current.initialEmail.email),
          requestedAt,
        };
      },
    });
    if (!result) throw new HouseAccountOpeningError("OTP_UNAVAILABLE", houseAccountOpeningErrorMessage("OTP_UNAVAILABLE"));
    return result;
  } catch (error) {
    if (error instanceof HouseAccountOpeningError) throw error;
    if (error instanceof AccountEmailServiceError) {
      throw new HouseAccountOpeningError("REQUEST_NOT_EDITABLE", houseAccountOpeningErrorMessage("REQUEST_NOT_EDITABLE"));
    }
    if (error instanceof EmailOtpServiceError) throw mapEmailOtpError(error);
    throw error;
  }
}

async function cancelHouseAccountOpeningInternal(requestId: string, cancelledAt: Date) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`house-opening-review:${requestId}`}))`;
    const openingRequest = await tx.houseAccountOpeningRequest.findUnique({
      where: { id: requestId },
      include: { initialEmail: true },
    });
    if (!openingRequest) {
      throw new HouseAccountOpeningError("REQUEST_NOT_FOUND", houseAccountOpeningErrorMessage("REQUEST_NOT_FOUND"));
    }
    if (!canApplicantCancelOpeningRequest(openingRequest.status)) {
      throw new HouseAccountOpeningError("REQUEST_NOT_EDITABLE", houseAccountOpeningErrorMessage("REQUEST_NOT_EDITABLE"));
    }
    if (openingRequest.initialEmail) {
      await tx.emailOtpChallenge.updateMany({
        where: {
          accountEmailId: openingRequest.initialEmail.id,
          purpose: "HOUSE_OPENING",
          status: { in: ["PENDING_DELIVERY", "ACTIVE", "VERIFIED"] },
        },
        data: { status: "CANCELLED" },
      });
    }
    const cancelled = await tx.houseAccountOpeningRequest.updateMany({
      where: { id: requestId, status: { in: [...LIVE_HOUSE_OPENING_STATUSES] } },
      data: { status: "CANCELLED" },
    });
    if (cancelled.count !== 1) {
      throw new HouseAccountOpeningError("REQUEST_NOT_EDITABLE", houseAccountOpeningErrorMessage("REQUEST_NOT_EDITABLE"));
    }
    await releaseOpeningRequestEmailInTransaction(tx, requestId, cancelledAt);
  });
}

export async function cancelHouseAccountOpening(requestId: string): Promise<void> {
  await cancelHouseAccountOpeningInternal(requestId, new Date());
}

export async function getHouseAccountOpeningStatus(requestId: string) {
  const openingRequest = await prisma.houseAccountOpeningRequest.findUnique({
    where: { id: requestId },
    include: {
      house: { select: { houseNumber: true } },
      initialEmail: true,
    },
  });
  if (!openingRequest || !openingRequest.initialEmail) {
    throw new HouseAccountOpeningError("REQUEST_NOT_FOUND", houseAccountOpeningErrorMessage("REQUEST_NOT_FOUND"));
  }
  const challenge = openingRequest.status === "PENDING_EMAIL_VERIFICATION"
    ? await prisma.emailOtpChallenge.findFirst({
        where: {
          accountEmailId: openingRequest.initialEmail.id,
          purpose: "HOUSE_OPENING",
          status: { in: ["PENDING_DELIVERY", "ACTIVE"] },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, expiresAt: true, resendAvailableAt: true },
      })
    : null;
  return {
    status: openingRequest.status,
    houseNumber: openingRequest.house.houseNumber,
    applicantName: `${openingRequest.applicantFirstName} ${openingRequest.applicantLastName}`,
    contactPhone: openingRequest.contactPhone,
    maskedEmail: maskEmail(openingRequest.initialEmail.email),
    requestedAt: openingRequest.requestedAt,
    rejectionReason: openingRequest.status === "REJECTED" ? openingRequest.rejectionReason : null,
    challengeId: challenge?.id ?? null,
    expiresAt: challenge?.expiresAt ?? null,
    resendAvailableAt: challenge?.resendAvailableAt ?? null,
  };
}
