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
import { Check, X, AlertCircle } from "lucide-react";

type PageProps = {
  searchParams?: Promise<{ q?: string; stage?: string; sort?: string }>;
};

async function fetchPendingAppointments(params: { q?: string; stage?: string; sort?: string }) {
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
    return [];
  }

  const keyword = params.q?.trim() ?? "";
  const activeStage = params.stage ?? "ALL";
  const activeSort = params.sort ?? "pending";

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
  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
      slot: true,
      village: {
        select: { name: true },
      },
      timeline: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy,
  });

  return appointments;
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
  const appointments = await fetchPendingAppointments(params);

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
            <Link href="/admin/appointments/slots">
              <Button size="sm">จัดการเวลาว่าง</Button>
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
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Link href={`/admin/appointments/${apt.id}`} className="font-medium text-gray-900 hover:underline">
                      {apt.title}
                    </Link>
                    <Badge variant={stageVariant[apt.stage] ?? "default"}>
                      {APPOINTMENT_STAGE_LABELS[apt.stage]}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>
                      <p className="text-xs text-gray-400">ผู้ขอ</p>
                      <p>{apt.user?.name || apt.user?.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">หมู่บ้าน</p>
                      <p>{apt.village?.name}</p>
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
                <div className="text-right">
                  {apt.stage === "PENDING_APPROVAL" && (
                    <div className="flex gap-2">
                      {apt.slotId ? (
                        <Link href={`/admin/appointments/${apt.id}?action=approve`}>
                          <Button size="sm" variant="primary">
                            <Check className="h-4 w-4" /> อนุมัติ
                          </Button>
                        </Link>
                      ) : (
                        <Link href={`/admin/appointments/${apt.id}?action=suggest`}>
                          <Button size="sm" variant="secondary">
                            <AlertCircle className="h-4 w-4" /> แนะนำเวลา
                          </Button>
                        </Link>
                      )}
                      <Link href={`/admin/appointments/${apt.id}?action=reject`}>
                        <Button size="sm" variant="outline">
                          <X className="h-4 w-4" /> ปฏิเสธ
                        </Button>
                      </Link>
                    </div>
                  )}
                  {apt.stage === "TIME_SUGGESTED" && (
                    <div className="flex gap-2">
                      <Link href={`/admin/appointments/${apt.id}`}>
                        <Button size="sm" variant="secondary">
                          <AlertCircle className="h-4 w-4" /> รอยืนยัน
                        </Button>
                      </Link>
                      <Link href={`/admin/appointments/${apt.id}`}>
                        <Button size="sm" variant="outline">
                          <X className="h-4 w-4" /> ยกเลิก
                        </Button>
                      </Link>
                    </div>
                  )}
                  {apt.stage === "APPROVED" && (
                    <div className="flex gap-2">
                      <Link href={`/admin/appointments/${apt.id}`}>
                        <Button size="sm" variant="outline">
                          <X className="h-4 w-4" /> ยกเลิก
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
