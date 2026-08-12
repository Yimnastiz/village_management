"use client";

import { Notification } from "@prisma/client";
import { NotificationCard } from "@/components/notifications/notification-card";
import { resolveResidentNotificationDestination } from "@/lib/resident-notification";
import { markNotificationAsReadAction } from "./actions";

export function NotificationItem({ notification }: { notification: Notification }) {
  return <NotificationCard notification={notification} title={notification.title} body={notification.body} destination={resolveResidentNotificationDestination(notification)} markAsRead={markNotificationAsReadAction} />;
}
