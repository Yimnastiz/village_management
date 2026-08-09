import { AlertCircle, Bell, Calendar, CalendarDays, CheckCircle2, Download, FileText, Globe, Home, Images, MapPin, Newspaper, Phone, User } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { WelcomeBanner } from "@/components/ui/welcome-banner";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NotificationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { APPOINTMENT_STAGE_LABELS, ISSUE_STAGE_LABELS } from "@/lib/constants";

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
    const [latestBindingRequest, linkedPerson, registeredVillage] = await Promise.all([
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
          village: { select: { name: true, slug: true } },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.person.findUnique({ where: { userId: session.id }, select: { house: { select: { houseNumber: true } } } }),
      prisma.user.findUnique({
        where: { id: session.id },
        select: { registrationVillage: { select: { name: true, slug: true } } },
      }),
    ]);
    const isPending = latestBindingRequest?.status === "PENDING";
    const isRejected = latestBindingRequest?.status === "REJECTED";
    const village = latestBindingRequest?.village ?? registeredVillage?.registrationVillage ?? null;
    const villageHref = village?.slug ? `/${village.slug}` : "/";
    const bindingHref = isPending ? "/resident/binding/pending" : "/resident/binding";
    const bindingActionLabel = isPending ? "ดูสถานะคำขอ" : isRejected ? "แก้ไขคำขอ" : "ขอผูกเลขบ้าน";
    const statusLabel = isPending ? "รอตรวจสอบ" : isRejected ? "ต้องแก้ไขคำขอ" : "ยังไม่ผูกเลขบ้าน";
    const availableServices = [
      { href: "/resident/news", label: "ข่าว/ประกาศ", description: "ติดตามข่าวสาธารณะของหมู่บ้าน", icon: Newspaper },
      { href: "/resident/calendar", label: "ปฏิทิน", description: "ดูกิจกรรมที่เผยแพร่สาธารณะ", icon: Calendar },
      { href: "/resident/gallery", label: "แกลเลอรี", description: "ดูภาพกิจกรรมของชุมชน", icon: Images },
      { href: "/resident/downloads", label: "เอกสาร", description: "ดาวน์โหลดเอกสารที่เปิดเผย", icon: Download },
      { href: "/resident/places", label: "สถานที่สำคัญ", description: "ค้นหาสถานที่และบริการใกล้ตัว", icon: MapPin },
      { href: "/resident/contacts", label: "ผู้ติดต่อ", description: "ช่องทางติดต่อของหมู่บ้าน", icon: Phone },
      { href: "/resident/profile", label: "โปรไฟล์", description: "จัดการข้อมูลบัญชีของคุณ", icon: User },
      { href: "/resident/notifications", label: "การแจ้งเตือน", description: "ดูและจัดการการแจ้งเตือนของคุณ", icon: Bell },
    ];

    return (
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-normal text-gray-950">
                สวัสดี, {session.name || "ลูกบ้าน"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                ตอนนี้บัญชีของคุณใช้งานได้ในโหมดสาธารณะ หากต้องการใช้เมนูสำหรับลูกบ้าน เช่น แจ้งปัญหา นัดหมาย และข้อมูลครัวเรือน ให้ส่งคำขอผูกเลขบ้านเพื่อให้ผู้ดูแลตรวจสอบ
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-shrink-0">
              <Link
                href={bindingHref}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
              >
                <FileText className="h-4 w-4" />
                {bindingActionLabel}
              </Link>
              <Link
                href={villageHref}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
              >
                ดูหน้าเว็บหมู่บ้าน
                <Globe className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {querySignupSuccess && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-semibold text-green-900">สมัครสมาชิกเรียบร้อยแล้ว</p>
                <p className="mt-1 text-sm text-green-800">ขั้นตอนถัดไปคือส่งคำขอผูกเลขบ้าน เพื่อเข้าใช้บริการสำหรับลูกบ้าน</p>
              </div>
            </div>
          </div>
        )}

        {linkedPerson?.house?.houseNumber ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            พบข้อมูลของคุณในทะเบียนบ้านเลขที่ {linkedPerson.house.houseNumber} แล้ว เหลือเพียงรอผู้ดูแลยืนยันสิทธิ์การใช้งาน
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-base font-semibold text-gray-950">ข้อมูลคำขอผูกเลขบ้าน</h2>
              <p className="mt-1 text-sm text-gray-500">
                {latestBindingRequest
                  ? "ตรวจสอบข้อมูลล่าสุดของคำขอที่ส่งไว้"
                  : "ยังไม่มีคำขอผูกเลขบ้าน เริ่มต้นจากปุ่มขอผูกเลขบ้านด้านบน"}
              </p>
            </div>
            {latestBindingRequest ? (
              <dl className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-gray-500">สถานะ</dt>
                  <dd className="mt-1 font-semibold text-gray-950">{statusLabel}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">วันที่ส่ง</dt>
                  <dd className="mt-1 font-semibold text-gray-950">{toThaiDate(latestBindingRequest.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">บ้านเลขที่</dt>
                  <dd className="mt-1 font-semibold text-gray-950">{latestBindingRequest.houseNumber ?? latestBindingRequest.house?.houseNumber ?? "-"}</dd>
                </div>
                {isRejected ? (
                  <div className="border-t border-gray-100 pt-4 sm:col-span-3">
                    <dt className="text-red-600">เหตุผลที่ปฏิเสธ</dt>
                    <dd className="mt-1 font-medium text-red-800">{latestBindingRequest.reviewNote || "ไม่ได้ระบุเหตุผล"}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <div className="mt-5 rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600">
                เมื่อส่งคำขอแล้ว ระบบจะแสดงสถานะ วันที่ส่ง และบ้านเลขที่ไว้ที่นี่
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-950">ขั้นตอนต่อไป</h2>
            <ol className="mt-4 space-y-3 text-sm text-gray-600">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700">1</span>
                ส่งคำขอผูกเลขบ้าน
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700">2</span>
                รอผู้ดูแลหมู่บ้านตรวจสอบ
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700">3</span>
                เข้าใช้งานเมนูลูกบ้านได้ครบ
              </li>
            </ol>
          </section>
        </div>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-semibold text-gray-950">เมนูที่ใช้งานได้ตอนนี้</h2>
              <p className="mt-1 text-sm text-gray-500">เข้าถึงข้อมูลสาธารณะของหมู่บ้านและจัดการบัญชีของคุณ</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {availableServices.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group min-h-24 rounded-lg border border-gray-200 p-4 transition-colors hover:border-green-200 hover:bg-green-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{item.label}</p>
                    <p className="mt-1 text-sm leading-5 text-gray-500">{item.description}</p>
                  </div>
                  <item.icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400 transition-colors group-hover:text-green-600" aria-hidden="true" />
                </div>
              </Link>
            ))}
          </div>
        </section>
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
