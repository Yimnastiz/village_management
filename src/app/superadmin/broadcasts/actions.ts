"use server";

import { AuditAction, NotificationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminActionSession, writeSuperAdminAuditLog } from "@/lib/superadmin";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function broadcastAnnouncementAction(formData: FormData) {
  const session = await requireSuperAdminActionSession();

  const title = readText(formData, "title");
  const body = readText(formData, "body");

  if (!title || !body) {
    throw new Error("กรุณากรอกหัวข้อและเนื้อหาประกาศ");
  }

  const [users, villages] = await Promise.all([
    prisma.user.findMany({ select: { id: true } }),
    prisma.village.findMany({ where: { isActive: true }, select: { id: true } }),
  ]);

  const notificationRows = users.map((user) => ({
    userId: user.id,
    type: NotificationType.SYSTEM,
    title,
    body,
    metadata: {
      actionUrl: "/resident/dashboard",
      actionLabel: "เปิดดู",
      source: "SUPERADMIN_BROADCAST",
    },
  }));

  if (notificationRows.length > 0) {
    await prisma.notification.createMany({
      data: notificationRows,
    });
  }

  if (villages.length > 0) {
    await prisma.emergencyBroadcast.createMany({
      data: villages.map((village) => ({
        villageId: village.id,
        title,
        content: body,
        type: "OTHER",
        status: "ACTIVE",
        createdBy: session.id,
      })),
    });
  }

  await writeSuperAdminAuditLog({
    userId: session.id,
    action: AuditAction.CREATE,
    resource: "SystemWideBroadcast",
    metadata: {
      title,
      notifiedUsers: users.length,
      villages: villages.length,
    },
  });

  revalidatePath("/superadmin/broadcasts");
  revalidatePath("/superadmin/dashboard");
}
