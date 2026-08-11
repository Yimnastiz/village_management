import {
  Users,
  Newspaper,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { redirect } from "next/navigation";
import { StatCard } from "@/components/ui/stat-card";
import { WelcomeBanner } from "@/components/ui/welcome-banner";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatThaiDateTime } from "@/lib/utils";
import { getAdminMembership, getSessionContextFromServerCookies, getHeadmanMembership } from "@/lib/access-control";
import { getVillageDisplayName } from "@/lib/village-display-name.server";
import {
  ISSUE_STAGE_LABELS,
  APPOINTMENT_STAGE_LABELS,
  NEWS_VISIBILITY_LABELS,
  NEWS_STAGE_LABELS,
} from "@/lib/constants";

const issueStageVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  WAITING: "warning",
  RESOLVED: "success",
  CLOSED: "default",
  REJECTED: "danger",
};

const appointmentStageVariant: Record<
  string,
  "default" | "info" | "success" | "warning" | "danger"
> = {
  PENDING_APPROVAL: "warning",
  TIME_SUGGESTED: "info",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "default",
  COMPLETED: "success",
};

function formatNotificationTime(date: Date): string {
  return date.toLocaleString("th-TH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminDashboard() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    redirect("/auth/login");
  }
  const adminMembership = getAdminMembership(session);
  if (!adminMembership) {
    redirect("/resident");
  }

  const village = await prisma.village.findUnique({
    where: { id: adminMembership.villageId },
    select: { id: true, name: true, moo: true, province: true, district: true, subdistrict: true },
  });
  if (!village) {
    redirect("/auth/login");
  }

  const headmanMembership = getHeadmanMembership(session);
  const userRole = headmanMembership ? "headman" : "admin";
  const membership = adminMembership;
  const villageName = await getVillageDisplayName(village);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [
    activeResidents,
    housesCount,
    publishedNewsCount,
    openIssueCount,
    pendingAppointmentCount,
    latestNotifications,
    recentIssues,
    todayAppointments,
    recentNews,
  ] = await Promise.all([
    prisma.villageMembership.count({
      where: {
        villageId: membership.villageId,
        status: "ACTIVE",
      },
    }),
    prisma.house.count({
      where: {
        villageId: membership.villageId,
      },
    }),
    prisma.news.count({
      where: {
        villageId: membership.villageId,
        stage: "PUBLISHED",
      },
    }),
    prisma.issue.count({
      where: {
        villageId: membership.villageId,
        stage: {
          in: ["OPEN", "IN_PROGRESS", "WAITING"],
        },
      },
    }),
    prisma.appointment.count({
      where: {
        villageId: membership.villageId,
        stage: "PENDING_APPROVAL",
      },
    }),
    prisma.notification.findMany({
      where: {
        userId: session.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 4,
      select: {
        id: true,
        title: true,
        body: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.issue.findMany({
      where: {
        villageId: membership.villageId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        title: true,
        stage: true,
        createdAt: true,
      },
    }),
    prisma.appointment.findMany({
      where: {
        villageId: membership.villageId,
        scheduledAt: {
          gte: todayStart,
          lt: todayEnd,
        },
        stage: {
          in: ["APPROVED", "TIME_SUGGESTED", "PENDING_APPROVAL"],
        },
      },
      orderBy: {
        scheduledAt: "asc",
      },
      take: 6,
      select: {
        id: true,
        title: true,
        stage: true,
        scheduledAt: true,
      },
    }),
    prisma.news.findMany({
      where: {
        villageId: membership.villageId,
      },
      orderBy: [
        {
          publishedAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      take: 5,
      select: {
        id: true,
        title: true,
        visibility: true,
        stage: true,
        publishedAt: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <WelcomeBanner
        villageName={villageName}
        userRole={userRole}
        userName={session.name}
        area="admin"
      />

      <div>
        <h1 className="text-2xl font-bold text-gray-900">แดชบอร์ด</h1>
        <p className="text-gray-500 text-sm mt-1">
          ภาพรวมระบบหมู่บ้าน {villageName}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="สมาชิกใช้งาน"
          value={activeResidents}
          icon={Users}
          color="blue"
          trend={`บ้านทั้งหมด ${housesCount} หลัง`}
        />
        <StatCard
          title="ข่าวที่เผยแพร่"
          value={publishedNewsCount}
          icon={Newspaper}
          color="green"
        />
        <StatCard
          title="ปัญหาค้างดำเนินการ"
          value={openIssueCount}
          icon={AlertCircle}
          color="yellow"
        />
        <StatCard
          title="นัดหมายรออนุมัติ"
          value={pendingAppointmentCount}
          icon={Calendar}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-gray-900">ปัญหาล่าสุด</h2>
            <Link href="/admin/issues" className="text-sm text-green-600 hover:underline">
              ดูทั้งหมด
            </Link>
          </div>
          <div className="space-y-3 text-sm">
            {recentIssues.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">ยังไม่มีรายการปัญหา</div>
            ) : (
              recentIssues.map((issue) => (
                <Link
                  key={issue.id}
                  href={`/admin/issues/${issue.id}`}
                  className="flex items-center justify-between gap-3 rounded border-b py-2 last:border-0 hover:bg-gray-50 px-2"
                >
                  <div className="min-w-0">
                    <p className="text-gray-700 line-clamp-1">{issue.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatThaiDateTime(issue.createdAt)}</p>
                  </div>
                  <Badge className="shrink-0" variant={issueStageVariant[issue.stage] ?? "default"}>
                    {ISSUE_STAGE_LABELS[issue.stage]}
                  </Badge>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-gray-900">นัดหมายวันนี้</h2>
            <Link href="/admin/appointments" className="text-sm text-green-600 hover:underline">
              ดูทั้งหมด
            </Link>
          </div>
          {todayAppointments.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">ไม่มีนัดหมายวันนี้</div>
          ) : (
            <div className="space-y-3">
              {todayAppointments.map((appointment) => (
                <Link
                  key={appointment.id}
                  href={`/admin/appointments/${appointment.id}`}
                  className="flex items-center justify-between gap-3 rounded border-b py-2 last:border-0 hover:bg-gray-50 px-2"
                >
                  <div className="min-w-0">
                    <p className="text-gray-700 line-clamp-1">{appointment.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {appointment.scheduledAt ? formatThaiDateTime(appointment.scheduledAt) : "ยังไม่กำหนดเวลา"}
                    </p>
                  </div>
                  <Badge className="shrink-0" variant={appointmentStageVariant[appointment.stage] ?? "default"}>
                    {APPOINTMENT_STAGE_LABELS[appointment.stage]}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-gray-900">ข่าวล่าสุด</h2>
            <Link href="/admin/news" className="text-sm text-green-600 hover:underline">
              จัดการข่าว
            </Link>
          </div>
          {recentNews.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">ยังไม่มีข่าว</div>
          ) : (
            <div className="space-y-3">
              {recentNews.map((news) => (
                <Link
                  key={news.id}
                  href={`/admin/news/${news.id}`}
                  className="flex flex-col gap-2 rounded border-b py-2 last:border-0 hover:bg-gray-50 px-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-gray-700 line-clamp-1">{news.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {(news.publishedAt ?? news.createdAt).toLocaleDateString("th-TH")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <Badge variant="outline">{NEWS_VISIBILITY_LABELS[news.visibility]}</Badge>
                    <Badge variant={news.stage === "PUBLISHED" ? "success" : "warning"}>
                      {NEWS_STAGE_LABELS[news.stage]}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-gray-900">การแจ้งเตือน</h2>
            <Link href="/admin/notifications" className="text-sm text-green-600 hover:underline">
              ดูแจ้งเตือน
            </Link>
          </div>

          {latestNotifications.length === 0 ? (
            <p className="py-5 text-center text-sm text-gray-400">ยังไม่มีการแจ้งเตือนล่าสุด</p>
          ) : (
            <div className="space-y-1">
              {latestNotifications.map((notification) => {
                const isUnread = notification.status === "UNREAD";

                return (
                  <Link
                    key={notification.id}
                    href={`/admin/notifications/${notification.id}`}
                    className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-gray-50"
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isUnread ? "bg-blue-500" : "bg-gray-300"}`}
                      aria-label={isUnread ? "ยังไม่ได้อ่าน" : "อ่านแล้ว"}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`line-clamp-1 text-sm ${isUnread ? "font-medium text-gray-900" : "text-gray-700"}`}>
                        {notification.title}
                      </p>
                      {notification.body ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{notification.body}</p>
                      ) : null}
                    </div>
                    <time className="shrink-0 text-xs text-gray-400" dateTime={notification.createdAt.toISOString()}>
                      {formatNotificationTime(notification.createdAt)}
                    </time>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
