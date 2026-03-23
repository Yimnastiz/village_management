"use server";

import { revalidatePath } from "next/cache";
import { NotificationStatus } from "@prisma/client";
import { getSessionContextFromServerCookies, isResidentUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

export async function markNotificationAsReadAction(notificationId: string) {
  const session = await getSessionContextFromServerCookies();
  if (!session || !isResidentUser(session)) {
    throw new Error("Unauthorized");
  }

  // Verify the notification belongs to this user
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification || notification.userId !== session.id) {
    throw new Error("Notification not found or unauthorized");
  }

  // Mark as read
  await prisma.notification.update({
    where: { id: notificationId },
    data: { status: NotificationStatus.READ, readAt: new Date() },
  });

  // Revalidate the notification page
  revalidatePath("/resident/notifications");

  return { success: true };
}

export async function markAllNotificationsAsReadAction() {
  const session = await getSessionContextFromServerCookies();
  if (!session || !isResidentUser(session)) {
    throw new Error("Unauthorized");
  }

  // Mark all unread notifications for this user as read
  await prisma.notification.updateMany({
    where: {
      userId: session.id,
      status: NotificationStatus.UNREAD,
    },
    data: {
      status: NotificationStatus.READ,
      readAt: new Date(),
    },
  });

  // Revalidate the notification page
  revalidatePath("/resident/notifications");

  return { success: true };
}
