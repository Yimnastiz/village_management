import { AlertCircle, Calendar, CalendarDays, Home, Newspaper, Bell } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { WelcomeBanner } from "@/components/ui/welcome-banner";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NotificationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { APPOINTMENT_STAGE_LABELS, ISSUE_STAGE_LABELS } from "@/lib/constants";
import { CheckCircle2, FileText } from "lucide-react";

const OPEN_ISSUE_STAGES = ["OPEN", "IN_PROGRESS", "WAITING"] as const;
const UPCOMING_APPOINTMENT_STAGES = ["PENDING_APPROVAL", "TIME_SUGGESTED", "APPROVED"] as const;

function toThaiDate(date: Date) {
  return date.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

type PageProps = {
  searchParams?: Promise<{ signup?: string }>;
};

export default async function ResidentDashboard({ searchParams }: PageProps) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    redirect("/auth/login?callbackUrl=/resident/dashboard");
  }
  const query = searchParams ? await searchParams : {};
  const querySignupSuccess = query.signup === "success";

  const membership = getResidentMembership(session);
  if (!membership) {
    const [latestBindingRequest, unreadNotifications, linkedPerson] = await Promise.all([
      prisma.bindingRequest.findFirst({
        where: {
          userId: session.id,
        },
        select: {
          id: true,
          createdAt: true,
          status: true,
          houseNumber: true,
          reviewNote: true,
          house: { select: { houseNumber: true } },
          village: { select: { name: true } },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.notification.count({
        where: { userId: session.id, status: NotificationStatus.UNREAD },
      }),
      prisma.person.findUnique({ where: { userId: session.id }, select: { house: { select: { houseNumber: true } } } }),
    ]);
    const isPending = latestBindingRequest?.status === "PENDING";
    const isRejected = latestBindingRequest?.status === "REJECTED";

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">สวัสดี, {session.name || "ลูกบ้าน"}!</h1>
          <p className="mt-1 text-sm text-gray-500">ขณะนี้บัญชีของคุณยังไม่ได้ผูกเลขบ้าน จึงสามารถดูได้เฉพาะข้อมูลสาธารณะของหมู่บ้าน</p>
        </div>

        {querySignupSuccess && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-semibold text-green-900">สมัครสมาชิกเรียบร้อยแล้ว</p>
                <p className="mt-1 text-sm text-green-800">ขั้นตอนถัดไปคือส่งคำขอผูกเลขบ้าน เพื่อเข้าใช้บริการสำหรับลูกบ้าน</p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
          {linkedPerson?.house?.houseNumber ? <p className="mb-3 text-sm text-amber-900">พบข้อมูลของคุณในทะเบียนบ้านเลขที่ {linkedPerson.house.houseNumber} แต่ยังต้องรอผู้ดูแลยืนยันสิทธิ์</p> : null}
          <p className="text-sm font-semibold text-amber-900">บัญชีของคุณยังไม่ผูกกับครัวเรือน</p>
          <p className="mt-1 text-sm text-amber-800">
            คุณยังเข้าใช้งานข้อมูลภายในหมู่บ้านไม่ได้จนกว่าจะผูกเลขบ้านและได้รับการอนุมัติ
            {isPending
              ? ` ส่งคำขอแล้วเมื่อ ${toThaiDate(latestBindingRequest.createdAt)} และกำลังรอผู้ใหญ่บ้านตรวจสอบ`
              : isRejected
                ? " คำขอล่าสุดถูกปฏิเสธ คุณสามารถแก้ไขข้อมูลและส่งใหม่ได้"
                : " เริ่มต้นด้วยการส่งคำขอผูกเลขบ้านให้ผู้ใหญ่บ้านตรวจสอบ"}
          </p>
          {latestBindingRequest ? (
            <dl className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-amber-200 bg-white/70 p-4 text-sm sm:grid-cols-3">
              <div><dt className="text-gray-500">วันที่ส่ง</dt><dd className="mt-1 font-medium text-gray-900">{toThaiDate(latestBindingRequest.createdAt)}</dd></div>
              <div><dt className="text-gray-500">หมู่บ้าน</dt><dd className="mt-1 font-medium text-gray-900">{latestBindingRequest.village?.name ?? "-"}</dd></div>
              <div><dt className="text-gray-500">บ้านเลขที่</dt><dd className="mt-1 font-medium text-gray-900">{latestBindingRequest.houseNumber ?? latestBindingRequest.house?.houseNumber ?? "-"}</dd></div>
              {isRejected ? <div className="sm:col-span-3"><dt className="text-red-600">เหตุผลที่ปฏิเสธ</dt><dd className="mt-1 font-medium text-red-800">{latestBindingRequest.reviewNote || "ไม่ได้ระบุเหตุผล"}</dd></div> : null}
            </dl>
          ) : null}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link
              href={isPending ? "/resident/binding/pending" : "/resident/binding"}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              <FileText className="h-4 w-4" />
              {isPending ? "ดูสถานะคำขอผูกเลขบ้าน" : isRejected ? "แก้ไขคำขอและส่งใหม่" : "ขอผูกเลขบ้าน"}
            </Link>
            <Link
              href="/resident/notifications"
              className="inline-flex items-center justify-center rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
            >
              ดูการแจ้งเตือน ({unreadNotifications})
            </Link>
          </div>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-semibold text-gray-900">บริการที่ใช้งานได้ตอนนี้</h2>
              <p className="mt-1 text-sm text-gray-500">คุณสามารถดูข้อมูลสาธารณะของหมู่บ้านและจัดการบัญชีของคุณได้</p>
            </div>
            <Link href="/resident/notifications" className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900">
              <Bell className="h-4 w-4" />
              {unreadNotifications > 0 ? `มีการแจ้งเตือนใหม่ ${unreadNotifications} รายการ` : "ไม่มีการแจ้งเตือนใหม่"}
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 lg:grid-cols-3">
            {[
              ["/resident/news", "ข่าวสาธารณะ"],
              ["/resident/calendar", "ปฏิทินกิจกรรม"],
              ["/resident/gallery", "แกลเลอรีสาธารณะ"],
              ["/resident/downloads", "เอกสารสาธารณะ"],
              ["/resident/places", "สถานที่"],
              ["/resident/contacts", "ช่องทางติดต่อ"],
              ["/resident/profile", "โปรไฟล์"],
              ["/resident/notifications", "การแจ้งเตือน"],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="flex min-h-11 items-center rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                {label}
              </Link>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-gray-900">ขั้นตอนต่อไป</h2>
            <ul className="mt-2 space-y-2 text-sm text-gray-600">
              <li>1. ส่งคำขอผูกบัญชีและยืนยันข้อมูลบ้าน</li>
              <li>2. รอเจ้าหน้าที่หมู่บ้านอนุมัติคำขอ</li>
              <li>3. กลับมาที่แดชบอร์ดเพื่อเข้าใช้งานครบทุกเมนู</li>
            </ul>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-gray-900">จัดการบัญชี</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/resident/profile" className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200">โปรไฟล์</Link>
              <Link href="/resident/notifications" className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200">การแจ้งเตือน</Link>
              <Link href="/resident/binding" className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200">ขอผูกเลขบ้าน</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const effectiveHouseId = membership.houseId;
  if (!effectiveHouseId) redirect("/resident/binding");

  const residentHouse = await prisma.house.findFirst({
    where: {
      id: effectiveHouseId,
      villageId: membership.villageId,
    },
    select: {
      houseNumber: true,
      address: true,
      village: {
        select: {
          name: true,
        },
      },
    },
  });

  const villageName = residentHouse?.village.name ?? "หมู่บ้าน";

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const [
    issueStats,
    upcomingAppointments,
    unreadNotifications,
    latestNews,
    latestIssues,
    villageEventsTodayCount,
    householdCount,
    villageEventsToday,
    housePersons,
    houseMemberships,
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
      select: {
        id: true,
        title: true,
        stage: true,
        scheduledAt: true,
        slot: { select: { date: true, startTime: true, endTime: true } },
      },
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
    prisma.villageEvent.count({
      where: {
        villageId: membership.villageId,
        startsAt: {
          gte: startOfToday,
          lt: endOfToday,
        },
      },
    }),
    prisma.house.count({
      where: {
        villageId: membership.villageId,
      },
    }),
    prisma.villageEvent.findMany({
      where: {
        villageId: membership.villageId,
        startsAt: {
          gte: startOfToday,
          lt: endOfToday,
        },
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
        location: true,
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
      take: 5,
    }),
    effectiveHouseId
      ? prisma.person.findMany({
          where: {
            houseId: effectiveHouseId,
          },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        })
      : Promise.resolve([]),
    effectiveHouseId
      ? prisma.villageMembership.findMany({
          where: {
            houseId: effectiveHouseId,
            status: "ACTIVE",
          },
          select: {
            id: true,
            user: { select: { id: true, name: true, phoneNumber: true } },
          },
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const personEntries = housePersons.map((person) => ({
    key: `person-${person.id}`,
    name: `${person.firstName} ${person.lastName}`.trim(),
    phone: person.phone ?? "-",
    source: "ทะเบียนบุคคล",
  }));

  const membershipEntries = houseMemberships.map((houseMembership) => ({
    key: `membership-${houseMembership.id}`,
    name: houseMembership.user.name,
    phone: houseMembership.user.phoneNumber,
    source: "ผู้ใช้งานระบบ",
  }));

  const ownHouseMembers = [...personEntries, ...membershipEntries].reduce<
    Array<{ key: string; name: string; phone: string; source: string }>
  >((accumulator, member) => {
    const normalizedName = member.name.trim().toLowerCase();
    const normalizedPhone = member.phone.trim();

    const duplicate = accumulator.some(
      (item) =>
        item.name.trim().toLowerCase() === normalizedName &&
        item.phone.trim() === normalizedPhone
    );

    if (!duplicate) {
      accumulator.push(member);
    }

    return accumulator;
  }, []);

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
      <WelcomeBanner
        villageName={villageName}
        userRole="resident"
        userName={session.name}
      />

      <div>
      <p className="text-gray-500 text-sm mt-1"> ภาพรวมข้อมูลของคุณ</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Link href="/resident/issues" className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600">
          <StatCard
            title="ปัญหาที่แจ้ง"
            value={String(totalIssues)}
            icon={AlertCircle}
            color="blue"
            trend={`${inProgressIssues} รายการกำลังดำเนินการ`}
            className="h-full transition-shadow hover:shadow-md"
          />
        </Link>
        <Link href="/resident/appointments" className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600">
          <StatCard
            title="นัดหมาย"
            value={String(upcomingAppointments.length)}
            icon={Calendar}
            color="green"
            trend={nextAppointmentText}
            className="h-full transition-shadow hover:shadow-md"
          />
        </Link>
        <Link href="/resident/news" className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600">
          <StatCard
            title="ข่าวล่าสุดหมู่บ้าน"
            value={String(latestNews.length)}
            icon={Newspaper}
            color="yellow"
            trend="แสดง 5 ข่าวล่าสุด"
            className="h-full transition-shadow hover:shadow-md"
          />
        </Link>
        <Link href="/resident/notifications" className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600">
          <StatCard
            title="การแจ้งเตือน"
            value={String(unreadNotifications)}
            icon={Bell}
            color="red"
            trend={unreadNotifications > 0 ? "ยังไม่ได้อ่าน" : "อ่านครบแล้ว"}
            className="h-full transition-shadow hover:shadow-md"
          />
        </Link>
        <Link href="/resident/calendar" className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600">
          <StatCard
            title="กิจกรรมหมู่บ้านวันนี้"
            value={String(villageEventsTodayCount)}
            icon={CalendarDays}
            color="purple"
            trend={toThaiDate(startOfToday)}
            className="h-full transition-shadow hover:shadow-md"
          />
        </Link>
        <Link href="/resident/household" className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600">
          <StatCard
            title="จำนวนครัวเรือน"
            value={String(householdCount)}
            icon={Home}
            color="green"
            trend="ครัวเรือนทั้งหมดในหมู่บ้าน"
            className="h-full transition-shadow hover:shadow-md"
          />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <h2 className="font-semibold text-gray-900 mb-4">นัดหมายของฉัน</h2>
          <div className="space-y-3">
            {upcomingAppointments.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">ยังไม่มีนัดหมายที่กำลังดำเนินการ</p>
            ) : (
              upcomingAppointments.map((appointment) => (
                <Link
                  key={appointment.id}
                  href={`/resident/appointments/${appointment.id}`}
                  className="flex items-center justify-between gap-3 py-2 border-b last:border-0"
                >
                  <div className="min-w-0">
                    <span className="text-sm text-gray-700 line-clamp-1">{appointment.title}</span>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {appointment.slot?.date
                        ? `${toThaiDate(appointment.slot.date)} ${appointment.slot.startTime}-${appointment.slot.endTime}`
                        : "รอจัดคิวเวลา"}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full font-medium bg-gray-100 text-gray-700 whitespace-nowrap">
                    {APPOINTMENT_STAGE_LABELS[appointment.stage] ?? appointment.stage}
                  </span>
                </Link>
              ))
            )}
          </div>
          <Link href="/resident/appointments" className="text-sm text-green-600 hover:underline mt-3 block">
            ดูทั้งหมด →
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <h2 className="font-semibold text-gray-900 mb-4">กิจกรรมหมู่บ้านวันนี้</h2>
          <div className="space-y-3">
            {villageEventsToday.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">วันนี้ยังไม่มีกิจกรรมในหมู่บ้าน</p>
            ) : (
              villageEventsToday.map((event) => (
                <Link
                  key={event.id}
                  href={`/resident/calendar/${event.id}`}
                  className="flex items-center justify-between gap-3 py-2 border-b last:border-0"
                >
                  <div className="min-w-0">
                    <span className="text-sm text-gray-700 line-clamp-1">{event.title}</span>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                      {event.location || "ไม่ระบุสถานที่"}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {event.startsAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </Link>
              ))
            )}
          </div>
          <Link href="/resident/calendar" className="text-sm text-green-600 hover:underline mt-3 block">
            ดูทั้งหมด →
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <h2 className="font-semibold text-gray-900 mb-4">สมาชิกในบ้านของฉัน</h2>
          <div className="space-y-3">
            {!effectiveHouseId ? (
              <p className="text-sm text-gray-500 py-2">ยังไม่พบเลขบ้านที่ผูกกับบัญชีของคุณ</p>
            ) : ownHouseMembers.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">ยังไม่พบข้อมูลสมาชิกในบ้านนี้</p>
            ) : (
              ownHouseMembers.map((householdMember) => (
                <div key={householdMember.key} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                  <div className="min-w-0">
                    <span className="text-sm text-gray-700 line-clamp-1">{householdMember.name || "-"}</span>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                      {householdMember.source}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full font-medium bg-gray-100 text-gray-700 whitespace-nowrap">
                    {householdMember.phone || "-"}
                  </span>
                </div>
              ))
            )}
          </div>
          {effectiveHouseId && (
            <p className="mt-3 text-xs text-gray-500">
              บ้านเลขที่ {residentHouse?.houseNumber ?? "-"} {residentHouse?.address ? `• ${residentHouse.address}` : ""}
            </p>
          )}
          <Link href="/resident/household" className="text-sm text-green-600 hover:underline mt-3 block">
            ดูทั้งหมด →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
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

        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
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
