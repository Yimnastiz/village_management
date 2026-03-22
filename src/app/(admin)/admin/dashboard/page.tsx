import {
  Users,
  Newspaper,
  AlertCircle,
  Calendar,
  Siren,
  Home,
  Bell,
} from "lucide-react";
import { redirect } from "next/navigation";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatThaiDateTime } from "@/lib/utils";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
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

export default async function AdminDashboard() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    redirect("/auth/login");
  }
  if (!isAdminUser(session)) {
    redirect("/resident");
  }

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: {
      villageId: true,
      village: {
        select: {
          name: true,
        },
      },
    },
  });
  if (!membership) {
    redirect("/auth/login");
  }

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
    todaySOSCount,
    unreadNotificationCount,
    recentIssues,
    todayAppointments,
    recentNews,
    activeEmergencyBroadcasts,
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
    prisma.emergencySOS.count({
      where: {
        villageId: membership.villageId,
        createdAt: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
    }),
    prisma.notification.count({
      where: {
        userId: session.id,
        status: "UNREAD",
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
    prisma.emergencyBroadcast.findMany({
      where: {
        villageId: membership.villageId,
        status: "ACTIVE",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 3,
      select: {
        id: true,
        title: true,
        type: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">แดชบอร์ด</h1>
        <p className="text-gray-500 text-sm mt-1">
          ภาพรวมระบบหมู่บ้าน {membership.village.name}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
        <StatCard title="SOS วันนี้" value={todaySOSCount} icon={Siren} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
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
                  className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-gray-50 rounded px-2"
                >
                  <div>
                    <p className="text-gray-700 line-clamp-1">{issue.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatThaiDateTime(issue.createdAt)}</p>
                  </div>
                  <Badge variant={issueStageVariant[issue.stage] ?? "default"}>
                    {ISSUE_STAGE_LABELS[issue.stage]}
                  </Badge>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
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
                  className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-gray-50 rounded px-2"
                >
                  <div>
                    <p className="text-gray-700 line-clamp-1">{appointment.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {appointment.scheduledAt ? formatThaiDateTime(appointment.scheduledAt) : "ยังไม่กำหนดเวลา"}
                    </p>
                  </div>
                  <Badge variant={appointmentStageVariant[appointment.stage] ?? "default"}>
                    {APPOINTMENT_STAGE_LABELS[appointment.stage]}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
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
                  className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-gray-50 rounded px-2"
                >
                  <div>
                    <p className="text-gray-700 line-clamp-1">{news.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {(news.publishedAt ?? news.createdAt).toLocaleDateString("th-TH")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
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

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">แจ้งเตือนและฉุกเฉิน</h2>
            <Link href="/admin/notifications" className="text-sm text-green-600 hover:underline">
              ดูแจ้งเตือน
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg border border-gray-200 px-4 py-3">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                <Bell className="h-3.5 w-3.5" />
                แจ้งเตือนยังไม่อ่าน
              </div>
              <p className="text-lg font-semibold text-gray-900">{unreadNotificationCount}</p>
            </div>
            <div className="rounded-lg border border-gray-200 px-4 py-3">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                <Home className="h-3.5 w-3.5" />
                ประกาศฉุกเฉินที่ active
              </div>
              <p className="text-lg font-semibold text-gray-900">{activeEmergencyBroadcasts.length}</p>
            </div>
          </div>

          {activeEmergencyBroadcasts.length > 0 ? (
            <div className="space-y-2">
              {activeEmergencyBroadcasts.map((broadcast) => (
                <div
                  key={broadcast.id}
                  className="rounded-lg border border-red-100 bg-red-50 px-3 py-2"
                >
                  <p className="text-sm font-medium text-red-800">{broadcast.title}</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {broadcast.type} • {formatThaiDateTime(broadcast.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-2">ไม่มีประกาศฉุกเฉินที่กำลังใช้งาน</p>
          )}
        </div>
      </div>
    </div>
  );
}
