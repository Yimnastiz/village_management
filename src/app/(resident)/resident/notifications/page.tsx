import Link from "next/link";
import { Bell } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionContextFromServerCookies, isResidentUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { NotificationStatus } from "@prisma/client";
import { NotificationItem } from "./notification-item";
import { MarkAllReadButton } from "./mark-all-read-button";

export default async function ResidentNotificationsPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session || !isResidentUser(session)) {
    redirect("/auth/login");
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">การแจ้งเตือน</h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              {unreadCount} ข้อความใหม่
            </span>
          )}
        </div>
        {unreadCount > 0 && <MarkAllReadButton />}
      </div>

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
