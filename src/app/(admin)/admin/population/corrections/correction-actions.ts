"use server";

import { AuditAction, CorrectionRequestStatus, NotificationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getVillagePermissionContext } from "@/lib/admin-permission.server";
import { prisma } from "@/lib/prisma";
import { ActionReasonError, requireActionReason } from "@/lib/sensitive-action-policy";

export type CorrectionActionState = { success: boolean; message?: string };

export async function reviewCorrectionAction(
  _state: CorrectionActionState,
  formData: FormData,
): Promise<CorrectionActionState> {
  const context = await getVillagePermissionContext("population.corrections.review");
  if (!context) return { success: false, message: "คุณไม่มีสิทธิ์พิจารณาคำขอนี้" };

  const requestId = String(formData.get("requestId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!requestId || (decision !== "APPROVE" && decision !== "REJECT")) {
    return { success: false, message: "ข้อมูลการพิจารณาไม่ถูกต้อง" };
  }

  const policyAction = decision === "REJECT" ? "population.correction.reject" : "population.correction.approve";
  let reason: string;
  try {
    reason = requireActionReason(policyAction, formData.get("reason"));
  } catch (error) {
    if (error instanceof ActionReasonError) return { success: false, message: "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร" };
    throw error;
  }

  const request = await prisma.householdCorrectionRequest.findFirst({
    where: { id: requestId, villageId: context.villageId, status: CorrectionRequestStatus.PENDING },
    select: { id: true, userId: true, subject: true },
  });
  if (!request) return { success: false, message: "ไม่พบคำขอ หรือคำขอถูกดำเนินการแล้ว" };

  await prisma.$transaction(async (tx) => {
    const changed = await tx.householdCorrectionRequest.updateMany({
      where: { id: request.id, villageId: context.villageId, status: CorrectionRequestStatus.PENDING },
      data: {
        status: decision === "APPROVE" ? CorrectionRequestStatus.APPROVED : CorrectionRequestStatus.REJECTED,
        reviewedBy: context.session.id,
        reviewedAt: new Date(),
        reviewNote: reason || null,
      },
    });
    if (changed.count !== 1) throw new Error("Correction request changed concurrently");

    await tx.notification.create({
      data: {
        userId: request.userId,
        villageId: context.villageId,
        type: NotificationType.SYSTEM,
        title: decision === "APPROVE" ? "คำขอแก้ไขได้รับการอนุมัติ" : "คำขอแก้ไขถูกปฏิเสธ",
        body: reason || (decision === "APPROVE" ? "คำขอแก้ไขข้อมูลของคุณได้รับการอนุมัติแล้ว" : "คำขอแก้ไขข้อมูลของคุณถูกปฏิเสธ"),
        metadata: { correctionRequestId: request.id, action: decision.toLowerCase() },
      },
    });
    await tx.auditLog.create({
      data: {
        userId: context.session.id,
        villageId: context.villageId,
        action: decision === "APPROVE" ? AuditAction.APPROVE : AuditAction.REJECT,
        resource: "HouseholdCorrectionRequest",
        resourceId: request.id,
        metadata: { actorRole: context.membership.role, policyAction, reason: reason || null, subject: request.subject },
      },
    });
  });

  revalidatePath("/admin/population/corrections");
  revalidatePath(`/admin/population/corrections/${request.id}`);
  revalidatePath("/admin/security");
  return { success: true, message: decision === "APPROVE" ? "อนุมัติคำขอเรียบร้อย" : "ปฏิเสธคำขอเรียบร้อย" };
}
