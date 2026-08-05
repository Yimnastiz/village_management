import { Bell } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { NotificationStatus } from "@prisma/client";
import { NotificationItem } from "./notification-item";
import { MarkAllReadButton } from "./mark-all-read-button";
import { ResidentPageToolbar } from "@/components/resident/resident-page-toolbar";

export default async function ResidentNotificationsPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    redirect("/auth/login?callbackUrl=/resident/dashboard");
  }

  const notifications = await prisma.notification.findMany({
    where: {
      userId: session.id,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const unreadCount = notifications.filter(
    (n) => n.status === NotificationStatus.UNREAD
  ).length;

  return (
    <div className="space-y-6">
      <ResidentPageToolbar
        namespace="resident-notifications"
        title="การแจ้งเตือน"
        description={unreadCount > 0 ? `${unreadCount} ข้อความใหม่` : undefined}
        actions={unreadCount > 0 ? <MarkAllReadButton /> : undefined}
      />

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="ยังไม่มีการแจ้งเตือน" />
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </div>
      )}
    </div>
  );
}
