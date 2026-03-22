import Link from "next/link";
import { Bell } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { NotificationStatus, NotificationType } from "@prisma/client";

export default async function NotificationsPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session) {
    redirect("/auth/login");
  }

  const notifications = await prisma.notification.findMany({
    where: {
      userId: session.id,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const getActionUrl = (notification: typeof notifications[0]): string | null => {
    const metadata = notification.metadata as Record<string, unknown> | null;
    return metadata?.actionUrl ? (metadata.actionUrl as string) : null;
  };

  const getActionLabel = (notification: typeof notifications[0]): string => {
    const metadata = notification.metadata as Record<string, unknown> | null;
    return metadata?.actionLabel ? (metadata.actionLabel as string) : "ไปยังหน้าต่อไป";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">การแจ้งเตือน</h1>
      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="ยังไม่มีการแจ้งเตือน" />
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const actionUrl = getActionUrl(notification);
            const actionLabel = getActionLabel(notification);
            const isUnread = notification.status === NotificationStatus.UNREAD;

            return (
              <div
                key={notification.id}
                className={`rounded-xl border border-gray-200 p-4 ${
                  isUnread ? "bg-blue-50 border-blue-200" : "bg-white"
                }`}
              >
                <div className="flex gap-3">
                  <div
                    className={`w-2.5 h-2.5 mt-1.5 rounded-full flex-shrink-0 ${
                      isUnread ? "bg-blue-500" : "bg-gray-300"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold ${
                      isUnread ? "text-gray-900" : "text-gray-700"
                    }`}>
                      {notification.title}
                    </p>
                    {notification.body && (
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.body}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-3">
                      <p className="text-xs text-gray-500">
                        {new Date(notification.createdAt).toLocaleDateString("th-TH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {actionUrl && (
                        <Link
                          href={actionUrl}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {actionLabel} →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
