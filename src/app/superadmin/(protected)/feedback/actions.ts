"use server";

import { NotificationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireSuperAdminActionSession } from "@/lib/superadmin";
import { getFeedbackById, markFeedbackAsReadIfUnread as markFeedbackAsReadIfUnreadService } from "./feedback-service";
import { prisma } from "@/lib/prisma";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function getFeedbackForAction(notificationId: string) {
  const row = await getFeedbackById(notificationId);
  if (!row) throw new Error("ไม่พบรายการความคิดเห็น");
  return row;
}

function revalidateFeedback(notificationId: string) {
  revalidatePath("/superadmin/feedback");
  revalidatePath(`/superadmin/feedback/${notificationId}`);
}

export async function markFeedbackAsReadIfUnread(notificationId: string) {
  await requireSuperAdminActionSession();
  await markFeedbackAsReadIfUnreadService(notificationId);
  revalidateFeedback(notificationId);
}

export async function updateFeedbackNotificationStatusAction(formData: FormData) {
  await requireSuperAdminActionSession();
  const notificationId = readText(formData, "notificationId");
  const requestedStatus = readText(formData, "status") as NotificationStatus;
  const operation = readText(formData, "operation");

  if (!notificationId) throw new Error("ไม่พบรายการความคิดเห็น");
  const row = await getFeedbackForAction(notificationId);

  if (operation === "restore") {
    if (row.status !== NotificationStatus.ARCHIVED) throw new Error("รายการนี้ยังไม่ได้เก็บถาวร");
    await prisma.notification.updateMany({
      where: { id: row.id, status: NotificationStatus.ARCHIVED },
      data: { status: row.readAt ? NotificationStatus.READ : NotificationStatus.UNREAD },
    });
  } else {
    if (![NotificationStatus.UNREAD, NotificationStatus.READ, NotificationStatus.ARCHIVED].includes(requestedStatus)) throw new Error("สถานะไม่ถูกต้อง");
    if (row.status === NotificationStatus.ARCHIVED) throw new Error("ไม่สามารถเปลี่ยนสถานะรายการที่เก็บถาวรแล้ว");

    await prisma.notification.updateMany({
      where: { id: row.id, status: row.status },
      data: {
        status: requestedStatus,
        ...(requestedStatus === NotificationStatus.READ && !row.readAt ? { readAt: new Date() } : {}),
        ...(requestedStatus === NotificationStatus.UNREAD ? { readAt: null } : {}),
      },
    });
  }

  revalidateFeedback(notificationId);
}
