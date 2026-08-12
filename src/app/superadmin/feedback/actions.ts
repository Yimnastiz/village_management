"use server";

import { NotificationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminActionSession } from "@/lib/superadmin";

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateFeedbackNotificationStatusAction(formData: FormData) {
  await requireSuperAdminActionSession();
  const notificationId = readText(formData, "notificationId");
  const status = readText(formData, "status");

  if (!notificationId) {
    throw new Error("ไม่พบรายการ feedback");
  }

  if (!Object.values(NotificationStatus).includes(status as NotificationStatus)) {
    throw new Error("สถานะไม่ถูกต้อง");
  }

  const row = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { id: true, metadata: true },
  });

  if (!row) {
    throw new Error("ไม่พบรายการ feedback");
  }

  const metadata = row.metadata as Record<string, unknown> | null;
  if (metadata?.source !== "PUBLIC_FEEDBACK") {
    throw new Error("รายการนี้ไม่ใช่ feedback");
  }

  await prisma.notification.update({
    where: { id: row.id },
    data: {
      status: status as NotificationStatus,
      readAt: status === NotificationStatus.READ ? new Date() : null,
    },
  });

  revalidatePath("/superadmin/feedback");
}
