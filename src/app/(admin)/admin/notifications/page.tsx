import { Bell } from "lucide-react";
import { NotificationStatus } from "@prisma/client";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminPageHeaderRegistration } from "@/components/layout/admin-page-header-context";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { groupNotificationsByDate } from "@/lib/notification-presentation";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { NotificationItem } from "./notification-item";
import { MarkAllReadButton } from "./mark-all-read-button";

const NOTIFICATION_GROUP_LABELS = { today: "วันนี้", yesterday: "เมื่อวาน", older: "ก่อนหน้านี้" };

export default async function AdminNotificationsPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session || !isAdminUser(session)) redirect("/auth/login");

  const notifications = await prisma.notification.findMany({ where: { userId: session.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unreadCount = notifications.filter((notification) => notification.status === NotificationStatus.UNREAD).length;
  const groupedNotifications = groupNotificationsByDate(notifications);

  return (
    <div className="space-y-6">
      <AdminPageHeaderRegistration context={{ title: "การแจ้งเตือน" }} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        {unreadCount > 0 ? <span className="text-sm font-medium text-gray-600">{unreadCount} รายการยังไม่ได้อ่าน</span> : <span />}
        {unreadCount > 0 ? <MarkAllReadButton /> : null}
      </div>
      {notifications.length === 0 ? <EmptyState icon={Bell} title="ยังไม่มีการแจ้งเตือน" /> : (
        <div className="space-y-6">
          {(Object.keys(NOTIFICATION_GROUP_LABELS) as Array<keyof typeof NOTIFICATION_GROUP_LABELS>).map((group) => groupedNotifications[group].length > 0 ? (
            <section key={group} aria-labelledby={`notification-group-${group}`} className="space-y-3">
              <h2 id={`notification-group-${group}`} className="text-sm font-semibold text-gray-700">{NOTIFICATION_GROUP_LABELS[group]}</h2>
              <div className="space-y-3">{groupedNotifications[group].map((notification) => <NotificationItem key={notification.id} notification={notification} />)}</div>
            </section>
          ) : null)}
        </div>
      )}
    </div>
  );
}
