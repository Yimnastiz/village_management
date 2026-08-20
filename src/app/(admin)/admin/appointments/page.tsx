import { prisma } from "@/lib/prisma";
import { getAdminMembership, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Prisma, type VillageMembershipRole } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { APPOINTMENT_STAGE_LABELS } from "@/lib/constants";
import { formatThaiDateTime } from "@/lib/utils";
import { AlertCircle, Clock } from "lucide-react";
import { QueryPagination } from "@/components/ui/query-pagination";
import { CreateAppointmentButton } from "./create-appointment-button";

type PageProps = {
  searchParams?: Promise<{ q?: string; stage?: string; sort?: string; page?: string }>;
};

async function fetchPendingAppointments(params: { q?: string; stage?: string; sort?: string; page?: string }) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id || !isAdminUser(session)) {
    redirect("/auth/login?error=unauthorized");
  }

  const membership = getAdminMembership(session);
  if (!membership) {
    return { appointments: [], totalCount: 0 };
  }

  const keyword = params.q?.trim() ?? "";
  const activeStage = params.stage ?? "ALL";
  const activeSort = params.sort === "oldest" || params.sort === "upcoming" ? params.sort : "newest";
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = 25;

  const where: Prisma.AppointmentWhereInput = {
    villageId: membership.villageId,
  };
  if (keyword) {
    where.OR = [
      { title: { contains: keyword, mode: "insensitive" } },
      { description: { contains: keyword, mode: "insensitive" } },
      { user: { name: { contains: keyword, mode: "insensitive" } } },
      { user: { email: { contains: keyword, mode: "insensitive" } } },
    ];
  }
  if (activeStage !== "ALL") {
    where.stage = activeStage as Prisma.AppointmentWhereInput["stage"];
  }

  const orderBy =
    activeSort === "oldest"
      ? [{ createdAt: "asc" as const }]
      : activeSort === "newest"
        ? [{ createdAt: "desc" as const }]
        : [{ createdAt: "desc" as const }];

  const select = {
    id: true, title: true, stage: true, slotId: true, scheduledAt: true, createdAt: true,
    user: { select: { email: true, name: true } },
    slot: { select: { date: true, startTime: true, endTime: true } },
    timeline: {
      orderBy: { createdAt: "asc" }, take: 1,
      select: { action: true, metadata: true, actor: { select: { name: true, email: true, memberships: { where: { villageId: membership.villageId, status: "ACTIVE" }, select: { role: true }, take: 1 } } } },
    },
  } satisfies Prisma.AppointmentSelect;

  const toAppointmentTime = (appointment: { scheduledAt: Date | null; slot: { date: Date; startTime: string } | null }) => {
    if (!appointment.scheduledAt || !appointment.slot) return null;
    const [hours, minutes] = appointment.slot.startTime.split(":").map(Number);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
    // Slot dates are stored as a calendar date. Combine it with the selected
    // start time in the project's Asia/Bangkok timezone before comparing it.
    return new Date(Date.UTC(appointment.slot.date.getUTCFullYear(), appointment.slot.date.getUTCMonth(), appointment.slot.date.getUTCDate(), hours, minutes) - 7 * 60 * 60 * 1000);
  };

  // Fetch only the active village's appointments; the Topbar supplies this context.
  const [rows, databaseTotalCount] = await Promise.all([
    prisma.appointment.findMany({
      where,
      ...(activeSort === "upcoming" ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      select,
      orderBy: activeSort === "upcoming" ? [{ createdAt: "desc" }] : orderBy,
    }),
    prisma.appointment.count({ where }),
  ]);
  const now = new Date();
  const upcomingAppointments = activeSort === "upcoming"
    ? rows.map((appointment) => ({ appointment, scheduledTime: toAppointmentTime(appointment) }))
      .filter((item): item is { appointment: typeof rows[number]; scheduledTime: Date } => item.appointment.stage === "APPROVED" && item.scheduledTime !== null && item.scheduledTime >= now)
      .sort((left, right) => left.scheduledTime.getTime() - right.scheduledTime.getTime())
      .map((item) => item.appointment)
    : [];
  const appointments = activeSort === "upcoming"
    ? upcomingAppointments.slice((page - 1) * pageSize, page * pageSize)
    : rows;
  const totalCount = activeSort === "upcoming" ? upcomingAppointments.length : databaseTotalCount;

  return { appointments, totalCount };
}

const ROLE_LABELS: Partial<Record<VillageMembershipRole, string>> = { HEADMAN: "ผู้ใหญ่บ้าน", ASSISTANT_HEADMAN: "ผู้ช่วยผู้ใหญ่บ้าน", COMMITTEE: "คณะกรรมการหมู่บ้าน", RESIDENT: "ลูกบ้าน" };

function getAppointmentSource(appointment: { timeline: Array<{ action: string; metadata: Prisma.JsonValue | null; actor: { name: string | null; email: string | null; memberships: Array<{ role: VillageMembershipRole }> } | null }> }) {
  const entry = appointment.timeline[0];
  const actor = entry?.actor;
  if (!entry || !actor) return null;
  const metadata = entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata) ? entry.metadata : null;
  const name = typeof metadata?.creatorName === "string" ? metadata.creatorName : actor.name || actor.email;
  if (!name) return null;
  const role = typeof metadata?.creatorRole === "string" ? metadata.creatorRole : actor.memberships[0]?.role;
  if (metadata?.adminCreated === true) return `สร้างโดย ${name} (${ROLE_LABELS[role as VillageMembershipRole] ?? "เจ้าหน้าที่"})`;
  if (entry.action === "CREATED") return `ส่งคำขอโดย ${name} (${ROLE_LABELS[role as VillageMembershipRole] ?? "ลูกบ้าน"})`;
  return null;
}

const stageVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING_APPROVAL: "warning",
  TIME_SUGGESTED: "info",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "default",
  COMPLETED: "info",
};

function getAppointmentSlotDateTime(appointment: {
  scheduledAt: Date | null;
  slot: { date: Date; startTime: string } | null;
}) {
  if (!appointment.scheduledAt || !appointment.slot) return null;

  const [hours, minutes] = appointment.slot.startTime.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;

  return new Date(Date.UTC(
    appointment.slot.date.getUTCFullYear(),
    appointment.slot.date.getUTCMonth(),
    appointment.slot.date.getUTCDate(),
    hours,
    minutes,
  ) - 7 * 60 * 60 * 1000);
}

export default async function AdminAppointmentsPage({ searchParams }: PageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};
  const keyword = params.q?.trim() ?? "";
  const activeStage = params.stage ?? "ALL";
  const activeSort = params.sort === "oldest" || params.sort === "upcoming" ? params.sort : "newest";
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = 25;
  const { appointments, totalCount } = await fetchPendingAppointments(params);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const suggestionTitles = Array.from(new Set(appointments.map((appointment) => appointment.title))).slice(0, 12);

  function buildAppointmentsHref(next: { q?: string; stage?: string; sort?: string }) {
    const query = new URLSearchParams();
    const q = next.q?.trim() ?? "";
    const stage = next.stage ?? "ALL";
    const sort = next.sort ?? "newest";
    if (q) query.set("q", q);
    if (stage !== "ALL") query.set("stage", stage);
    if (sort !== "newest") query.set("sort", sort);
    const queryString = query.toString();
    return queryString ? `/admin/appointments?${queryString}` : "/admin/appointments";
  }

  return (
    <div data-admin-compact-top className="space-y-3">
      <AdminListToolbar
        sticky
        title="จัดการนัดหมาย"
        description="ตรวจสอบคำขอนัดหมาย กรองตามสถานะ และค้นหาจากชื่อเรื่องหรือผู้นัดหมาย"
        searchAction="/admin/appointments"
        keyword={keyword}
        searchPlaceholder="ค้นหาจากหัวข้อหรือชื่อผู้นัดหมาย"
        hiddenInputs={{ stage: activeStage === "ALL" ? "" : activeStage, sort: activeSort === "newest" ? "" : activeSort }}
        clearHref={buildAppointmentsHref({ q: keyword })}
        suggestionTitles={suggestionTitles}
        groups={[
          {
            label: "สถานะ",
            options: [
              { label: "ทั้งหมด", href: buildAppointmentsHref({ q: keyword, stage: "ALL", sort: activeSort }), active: activeStage === "ALL" },
              { label: "รออนุมัติ", href: buildAppointmentsHref({ q: keyword, stage: "PENDING_APPROVAL", sort: activeSort }), active: activeStage === "PENDING_APPROVAL" },
              { label: "รอลูกบ้านยืนยันเวลา", href: buildAppointmentsHref({ q: keyword, stage: "TIME_SUGGESTED", sort: activeSort }), active: activeStage === "TIME_SUGGESTED" },
              { label: "อนุมัติแล้ว", href: buildAppointmentsHref({ q: keyword, stage: "APPROVED", sort: activeSort }), active: activeStage === "APPROVED" },
              { label: "เสร็จสิ้น", href: buildAppointmentsHref({ q: keyword, stage: "COMPLETED", sort: activeSort }), active: activeStage === "COMPLETED" },
            ],
          },
          {
            label: "เรียง",
            countsAsFilter: false,
            options: [
              { label: "สร้างล่าสุดก่อน", href: buildAppointmentsHref({ q: keyword, stage: activeStage, sort: "newest" }), active: activeSort === "newest" },
              { label: "สร้างเก่าสุดก่อน", href: buildAppointmentsHref({ q: keyword, stage: activeStage, sort: "oldest" }), active: activeSort === "oldest" },
              { label: "นัดหมายใกล้ถึงก่อน", href: buildAppointmentsHref({ q: keyword, stage: activeStage, sort: "upcoming" }), active: activeSort === "upcoming" },
            ],
          },
        ]}
        actions={
          <>
            <CreateAppointmentButton />
            <Link href="/admin/appointments/calendar">
              <Button size="sm" variant="outline">ปฏิทินนัดหมาย</Button>
            </Link>
          </>
        }
      />

      {appointments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">ยังไม่มีคำขอนัดหมาย</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((apt) => {
            const slotDateTime = getAppointmentSlotDateTime(apt);
            const isTimeSuggested = apt.stage === "TIME_SUGGESTED";
            const isConfirmed = ["APPROVED", "COMPLETED"].includes(apt.stage);
            const source = getAppointmentSource(apt);

            return (
            <div
              key={apt.id}
              className="relative bg-white rounded-xl border border-gray-200 p-4 transition-shadow hover:shadow-md"
            >
              <Link href={`/admin/appointments/${apt.id}`} aria-label={`ดูรายละเอียดนัดหมาย ${apt.title}`} className="absolute inset-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2" />
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <p className="font-medium text-gray-900">
                      {apt.title}
                    </p>
                    <Badge variant={stageVariant[apt.stage] ?? "default"}>
                      {isTimeSuggested ? "รอลูกบ้านยืนยันเวลา" : APPOINTMENT_STAGE_LABELS[apt.stage]}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p><span className="text-gray-500">นัดหมายกับ: </span><span className="break-words text-gray-900">{apt.user?.name || apt.user?.email}</span></p>
                    {source ? <p className="break-words text-gray-500">{source}</p> : null}
                  </div>
                </div>
                <div className="min-w-0 space-y-2 lg:text-right">
                  {slotDateTime ? (
                    <p className="flex items-center gap-1.5 font-medium text-gray-900 lg:justify-end"><Clock aria-hidden className="h-4 w-4 shrink-0 text-gray-500" />{isConfirmed ? "นัดหมาย" : "เสนอเวลา"}: {formatThaiDateTime(slotDateTime)}</p>
                  ) : <p className="font-medium text-gray-700">นัดหมาย: ยังไม่กำหนดเวลา</p>}
                  <p className="text-xs text-gray-400">สร้างเมื่อ {formatThaiDateTime(apt.createdAt)}</p>
                  <div className="relative z-10">
                  {apt.stage === "PENDING_APPROVAL" && (
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Link href={`/admin/appointments/${apt.id}`}><Button size="sm" variant="secondary"><AlertCircle className="h-4 w-4" /> เสนอวันเวลา</Button></Link>
                    </div>
                  )}
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
      <QueryPagination pathname="/admin/appointments" page={page} totalPages={totalPages} params={{ q: keyword || undefined, stage: activeStage !== "ALL" ? activeStage : undefined, sort: activeSort !== "newest" ? activeSort : undefined }} />
    </div>
  );
}
