import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { NotificationStatus } from "@prisma/client";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ notificationId: string }>;
};

export default async function AdminNotificationDetailPage({ params }: PageProps) {
  const { notificationId } = await params;
  const session = await getSessionContextFromServerCookies();
  if (!session?.id || !isAdminUser(session)) {
    redirect("/auth/login?callbackUrl=/admin/notifications");
  }

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification || notification.userId !== session.id) {
    notFound();
  }

  if (notification.status === NotificationStatus.UNREAD) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/admin/notifications" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> กลับไปหน้าแจ้งเตือน
      </Link>

      <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-xl font-bold text-gray-900">{notification.title}</h1>
        <p className="mt-2 text-xs text-gray-500">{notification.createdAt.toLocaleString("th-TH")}</p>
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="whitespace-pre-wrap text-sm leading-7 text-gray-700">{notification.body || "-"}</p>
        </div>
      </article>
    </div>
  );
}
