import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { NotificationStatus } from "@prisma/client";
import { getAdminMembership, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { getAdminNotificationCopy, resolveAdminNotificationDestination } from "@/lib/admin-notification";
import { NotificationDetailHeader, notificationDetailAccent } from "@/components/notifications/notification-detail-header";
import { prisma } from "@/lib/prisma";

export default async function AdminNotificationDetailPage({ params }: { params: Promise<{ notificationId: string }> }) {
  const { notificationId } = await params;
  const session = await getSessionContextFromServerCookies();
  const membership = session ? getAdminMembership(session) : null;
  if (!session?.id || !membership || !isAdminUser(session)) redirect("/auth/login?callbackUrl=/admin/notifications");
  const notification = await prisma.notification.findFirst({ where: { id: notificationId, userId: session.id, villageId: membership.villageId } });
  if (!notification) notFound();
  if (notification.status === NotificationStatus.UNREAD) await prisma.notification.update({ where: { id: notification.id }, data: { status: NotificationStatus.READ, readAt: new Date() } });
  const copy = getAdminNotificationCopy(notification);
  const destination = resolveAdminNotificationDestination(notification);
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <Link href="/admin/notifications" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="size-4" /> กลับไปหน้าการแจ้งเตือน
      </Link>
      <article className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 ${notificationDetailAccent(notification)}`}>
        <NotificationDetailHeader notification={notification} title={copy.title} />
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-700">{copy.body || "-"}</p>
        </div>
        {destination && destination !== `/admin/notifications/${notification.id}` ? <Link href={destination} className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700">ดูรายละเอียด</Link> : null}
      </article>
    </div>
  );
}
