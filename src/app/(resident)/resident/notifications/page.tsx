import { Bell } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { NotificationStatus } from "@prisma/client";
import { NotificationItem } from "./notification-item";
import { MarkAllReadButton } from "./mark-all-read-button";
import { ResidentPageHeaderRegistration } from "@/components/layout/resident-page-header-context";

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
      <ResidentPageHeaderRegistration context={{ title: "การแจ้งเตือน", description: unreadCount > 0 ? `${unreadCount} รายการยังไม่ได้อ่าน` : "ติดตามข่าวสารและการอัปเดตที่เกี่ยวข้องกับคุณ" }} />
      {unreadCount > 0 ? <div className="flex justify-end"><MarkAllReadButton /></div> : null}

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
