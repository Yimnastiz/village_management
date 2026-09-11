"use server";

import { revalidatePath } from "next/cache";
import { NotificationStatus } from "@prisma/client";
import { getAdminMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

export async function markNotificationAsReadAction(notificationId: string) {
  const session = await getSessionContextFromServerCookies();
  const membership = session ? getAdminMembership(session) : null;
  if (!session || !membership) {
    throw new Error("Unauthorized");
  }

  // Verify the notification belongs to this user
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId: session.id, villageId: membership.villageId },
  });

  if (!notification) {
    throw new Error("Notification not found or unauthorized");
  }

  // Mark as read
  await prisma.notification.update({
    where: { id: notificationId },
    data: { status: NotificationStatus.READ, readAt: new Date() },
  });

  revalidatePath("/admin", "layout");
  revalidatePath("/admin/notifications");

  return { success: true };
}

export async function markAllNotificationsAsReadAction() {
  const session = await getSessionContextFromServerCookies();
  const membership = session ? getAdminMembership(session) : null;
  if (!session || !membership) {
    throw new Error("Unauthorized");
  }

  // Mark all unread notifications for this user as read
  await prisma.notification.updateMany({
    where: {
      userId: session.id,
      villageId: membership.villageId,
      status: NotificationStatus.UNREAD,
    },
    data: {
      status: NotificationStatus.READ,
      readAt: new Date(),
    },
  });

  revalidatePath("/admin", "layout");
  revalidatePath("/admin/notifications");

  return { success: true };
}
