import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { isAdminUser } from "@/lib/access-control";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { APPOINTMENT_STAGE_LABELS } from "@/lib/constants";
import { formatThaiDate } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import { QueryPagination } from "@/components/ui/query-pagination";

type PageProps = {
  searchParams?: Promise<{ q?: string; stage?: string; sort?: string; page?: string }>;
};

async function fetchPendingAppointments(params: { q?: string; stage?: string; sort?: string; page?: string }) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id || !isAdminUser(session)) {
    redirect("/auth/login?error=unauthorized");
  }

  // Get admin's villages
  const memberships = await prisma.villageMembership.findMany({
    where: {
      userId: session.id,
      role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] },
    },
    select: { villageId: true },
  });

  const villageIds = memberships.map((m) => m.villageId);

  if (villageIds.length === 0) {
    return { appointments: [], totalCount: 0 };
  }

  const keyword = params.q?.trim() ?? "";
  const activeStage = params.stage ?? "ALL";
  const activeSort = params.sort ?? "pending";
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = 25;

  const where: Prisma.AppointmentWhereInput = {
    villageId: { in: villageIds },
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
        : [{ stage: "asc" as const }, { createdAt: "desc" as const }];

  // Fetch appointments from admin's villages, prioritize pending
  const [appointments, totalCount] = await Promise.all([prisma.appointment.findMany({
    where,
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true, title: true, stage: true, slotId: true, scheduledAt: true,
      user: {
        select: {
          email: true,
          name: true,
        },
      },
      slot: { select: { date: true, startTime: true, endTime: true } },
      village: {
        select: { name: true },
      },
    },
    orderBy,
  }), prisma.appointment.count({ where })]);

  return { appointments, totalCount };
}

const stageVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING_APPROVAL: "warning",
  TIME_SUGGESTED: "info",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "default",
  COMPLETED: "info",
};

export default async function AdminAppointmentsPage({ searchParams }: PageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};
  const keyword = params.q?.trim() ?? "";
  const activeStage = params.stage ?? "ALL";
  const activeSort = params.sort ?? "pending";
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = 25;
  const { appointments, totalCount } = await fetchPendingAppointments(params);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const suggestionTitles = Array.from(new Set(appointments.map((appointment) => appointment.title))).slice(0, 12);

  function buildAppointmentsHref(next: { q?: string; stage?: string; sort?: string }) {
    const query = new URLSearchParams();
    const q = next.q?.trim() ?? "";
    const stage = next.stage ?? "ALL";
    const sort = next.sort ?? "pending";
    if (q) query.set("q", q);
    if (stage !== "ALL") query.set("stage", stage);
    if (sort !== "pending") query.set("sort", sort);
    const queryString = query.toString();
    return queryString ? `/admin/appointments?${queryString}` : "/admin/appointments";
  }

  return (
    <div className="space-y-6">
      <AdminListToolbar
        title="จัดการนัดหมาย"
        description="ตรวจสอบคำขอนัดหมาย กรองตามสถานะ และค้นหาจากชื่อเรื่องหรือผู้ขอ"
        searchAction="/admin/appointments"
        keyword={keyword}
        searchPlaceholder="ค้นหาจากหัวข้อหรือชื่อผู้ขอ"
        hiddenInputs={{ stage: activeStage === "ALL" ? "" : activeStage, sort: activeSort === "pending" ? "" : activeSort }}
        suggestionTitles={suggestionTitles}
        groups={[
          {
            label: "สถานะ",
            options: [
              { label: "ทั้งหมด", href: buildAppointmentsHref({ q: keyword, stage: "ALL", sort: activeSort }), active: activeStage === "ALL" },
              { label: "รออนุมัติ", href: buildAppointmentsHref({ q: keyword, stage: "PENDING_APPROVAL", sort: activeSort }), active: activeStage === "PENDING_APPROVAL" },
              { label: "รอยืนยันเวลา", href: buildAppointmentsHref({ q: keyword, stage: "TIME_SUGGESTED", sort: activeSort }), active: activeStage === "TIME_SUGGESTED" },
              { label: "อนุมัติแล้ว", href: buildAppointmentsHref({ q: keyword, stage: "APPROVED", sort: activeSort }), active: activeStage === "APPROVED" },
              { label: "เสร็จสิ้น", href: buildAppointmentsHref({ q: keyword, stage: "COMPLETED", sort: activeSort }), active: activeStage === "COMPLETED" },
            ],
          },
          {
            label: "เรียง",
            options: [
              { label: "รออนุมัติก่อน", href: buildAppointmentsHref({ q: keyword, stage: activeStage, sort: "pending" }), active: activeSort === "pending" },
              { label: "ล่าสุดก่อน", href: buildAppointmentsHref({ q: keyword, stage: activeStage, sort: "newest" }), active: activeSort === "newest" },
              { label: "เก่าก่อน", href: buildAppointmentsHref({ q: keyword, stage: activeStage, sort: "oldest" }), active: activeSort === "oldest" },
            ],
          },
        ]}
        actions={
          <>
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
          {appointments.map((apt) => (
            <div
              key={apt.id}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Link href={`/admin/appointments/${apt.id}`} className="font-medium text-gray-900 hover:underline">
                      {apt.title}
                    </Link>
                    <Badge variant={stageVariant[apt.stage] ?? "default"}>
                      {APPOINTMENT_STAGE_LABELS[apt.stage]}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-3 text-sm text-gray-600 sm:grid-cols-2 sm:gap-4">
                    <div>
                      <p className="text-xs text-gray-400">ผู้ขอ</p>
                      <p className="break-words">{apt.user?.name || apt.user?.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">หมู่บ้าน</p>
                      <p className="break-words">{apt.village?.name}</p>
                    </div>
                    {(apt.slot || apt.scheduledAt) && (
                      <div>
                        <p className="text-xs text-gray-400">
                          {apt.slot ? "วันที่" : "วันที่ที่ลูกบ้านต้องการ"}
                        </p>
                        <p>{formatThaiDate(apt.slot?.date ?? apt.scheduledAt!)}</p>
                      </div>
                    )}
                    {apt.slot && (
                      <div>
                        <p className="text-xs text-gray-400">เวลา</p>
                        <p>{apt.slot.startTime} - {apt.slot.endTime}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-left lg:text-right">
                  {apt.stage === "PENDING_APPROVAL" && (
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Link href={`/admin/appointments/${apt.id}`}><Button size="sm" variant="secondary"><AlertCircle className="h-4 w-4" /> เสนอวันเวลา</Button></Link>
                    </div>
                  )}
                  {apt.stage === "TIME_SUGGESTED" && (
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Link href={`/admin/appointments/${apt.id}`}>
                        <Button size="sm" variant="secondary"><AlertCircle className="h-4 w-4" /> รอลูกบ้านยืนยัน</Button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <QueryPagination pathname="/admin/appointments" page={page} totalPages={totalPages} params={{ q: keyword || undefined, stage: activeStage !== "ALL" ? activeStage : undefined, sort: activeSort !== "pending" ? activeSort : undefined }} />
    </div>
  );
}
