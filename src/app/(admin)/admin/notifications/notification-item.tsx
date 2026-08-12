"use client";

import { Notification } from "@prisma/client";
import { NotificationCard } from "@/components/notifications/notification-card";
import { getAdminNotificationCopy, resolveAdminNotificationDestination } from "@/lib/admin-notification";
import { markNotificationAsReadAction } from "./actions";

export function NotificationItem({ notification }: { notification: Notification }) {
  const copy = getAdminNotificationCopy(notification);
  return <NotificationCard notification={notification} title={copy.title} body={copy.body} destination={resolveAdminNotificationDestination(notification)} markAsRead={markNotificationAsReadAction} />;
}
