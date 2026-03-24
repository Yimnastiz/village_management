import { AlertCircle, Calendar, Newspaper, Bell } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NotificationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { ISSUE_STAGE_LABELS } from "@/lib/constants";

const OPEN_ISSUE_STAGES = ["OPEN", "IN_PROGRESS", "WAITING"] as const;
const UPCOMING_APPOINTMENT_STAGES = ["PENDING_APPROVAL", "TIME_SUGGESTED", "APPROVED"] as const;

function toThaiDate(date: Date) {
  return date.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

export default async function ResidentDashboard() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    redirect("/auth/login?callbackUrl=/resident/dashboard");
  }

  const membership = getResidentMembership(session);
  if (!membership) {
    redirect("/auth/binding");
  }

  const [
    issueStats,
    upcomingAppointments,
    unreadNotifications,
    latestNews,
    latestIssues,
  ] = await Promise.all([
    prisma.issue.groupBy({
      by: ["stage"],
      where: { reporterId: session.id },
      _count: { _all: true },
    }),
    prisma.appointment.findMany({
      where: {
        userId: session.id,
        stage: { in: [...UPCOMING_APPOINTMENT_STAGES] },
      },
      include: { slot: true },
      orderBy: [{ slot: { date: "asc" } }, { createdAt: "asc" }],
      take: 5,
    }),
    prisma.notification.count({
      where: { userId: session.id, status: NotificationStatus.UNREAD },
    }),
    prisma.news.findMany({
      where: {
        villageId: membership.villageId,
        stage: "PUBLISHED",
        visibility: { in: ["PUBLIC", "RESIDENT_ONLY"] },
      },
      select: { id: true, title: true, publishedAt: true, createdAt: true },
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
    prisma.issue.findMany({
      where: { reporterId: session.id },
      select: { id: true, title: true, stage: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const totalIssues = issueStats.reduce((sum, row) => sum + row._count._all, 0);
  const inProgressIssues = issueStats
    .filter((row) => OPEN_ISSUE_STAGES.includes(row.stage as (typeof OPEN_ISSUE_STAGES)[number]))
    .reduce((sum, row) => sum + row._count._all, 0);

  const nextAppointment = upcomingAppointments.find((appointment) => appointment.slot?.date);
  const nextAppointmentText = nextAppointment?.slot?.date
    ? `นัดหน้า: ${toThaiDate(nextAppointment.slot.date)}`
    : "ยังไม่มีนัดหมายที่กำลังดำเนินการ";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">สวัสดี, {session.name || "ลูกบ้าน"}!</h1>
        <p className="text-gray-500 text-sm mt-1">ภาพรวมข้อมูลของคุณ</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="ปัญหาที่แจ้ง"
          value={String(totalIssues)}
          icon={AlertCircle}
          color="blue"
          trend={`${inProgressIssues} รายการกำลังดำเนินการ`}
        />
        <StatCard
          title="นัดหมาย"
          value={String(upcomingAppointments.length)}
          icon={Calendar}
          color="green"
          trend={nextAppointmentText}
        />
        <StatCard
          title="ข่าวล่าสุดหมู่บ้าน"
          value={String(latestNews.length)}
          icon={Newspaper}
          color="yellow"
          trend="แสดง 5 ข่าวล่าสุด"
        />
        <StatCard
          title="การแจ้งเตือน"
          value={String(unreadNotifications)}
          icon={Bell}
          color="red"
          trend={unreadNotifications > 0 ? "ยังไม่ได้อ่าน" : "อ่านครบแล้ว"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">ข่าวล่าสุด</h2>
          <div className="space-y-3">
            {latestNews.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">ยังไม่มีข่าวในหมู่บ้านของคุณ</p>
            ) : (
              latestNews.map((news) => (
                <Link
                  key={news.id}
                  href={`/resident/news/${news.id}`}
                  className="flex items-center gap-3 py-2 border-b last:border-0"
                >
                  <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm text-gray-700 line-clamp-1">{news.title}</span>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {toThaiDate(news.publishedAt ?? news.createdAt)}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
          <Link href="/resident/news" className="text-sm text-green-600 hover:underline mt-3 block">
            ดูทั้งหมด →
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">ปัญหาล่าสุด</h2>
          <div className="space-y-3">
            {latestIssues.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">ยังไม่มีคำร้องที่คุณแจ้ง</p>
            ) : (
              latestIssues.map((issue) => (
                <Link
                  key={issue.id}
                  href={`/resident/issues/${issue.id}`}
                  className="flex items-center justify-between gap-3 py-2 border-b last:border-0"
                >
                  <span className="text-sm text-gray-700 line-clamp-1">{issue.title}</span>
                  <span className="text-xs px-2 py-1 rounded-full font-medium bg-gray-100 text-gray-700">
                    {ISSUE_STAGE_LABELS[issue.stage] || issue.stage}
                  </span>
                </Link>
              ))
            )}
          </div>
          <Link href="/resident/issues" className="text-sm text-green-600 hover:underline mt-3 block">
            ดูทั้งหมด →
          </Link>
        </div>
      </div>
    </div>
  );
}
