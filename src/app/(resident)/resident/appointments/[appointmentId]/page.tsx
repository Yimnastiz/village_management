import Link from "next/link";
import { AlertCircle, ArrowLeft, CalendarClock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { APPOINTMENT_STAGE_LABELS } from "@/lib/constants";
import { formatThaiDate } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { AppointmentActions } from "./appointment-actions";

interface PageProps { 
  params: Promise<{ appointmentId: string }>;
  searchParams?: Promise<{ from?: string; month?: string; date?: string }>;
}

const stageVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING_APPROVAL: "warning",
  TIME_SUGGESTED: "info",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "default",
  COMPLETED: "info",
};

type AppointmentMetadata = {
  adminCreated?: boolean;
  adminMessage?: string;
  creatorName?: string;
  creatorRole?: string;
  reason?: string;
  targetAdminName?: string;
  targetAdminRole?: string;
  targetAdminPhone?: string;
  responderName?: string;
  responderRole?: string;
  responderPhone?: string;
};

function readAppointmentMetadata(value: Prisma.JsonValue | null): AppointmentMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const readString = (key: string) => typeof value[key] === "string" ? value[key] : undefined;
  return {
    adminCreated: value.adminCreated === true,
    adminMessage: readString("adminMessage"),
    creatorName: readString("creatorName"),
    creatorRole: readString("creatorRole"),
    reason: readString("reason"),
    targetAdminName: readString("targetAdminName"),
    targetAdminRole: readString("targetAdminRole"),
    targetAdminPhone: readString("targetAdminPhone"),
    responderName: readString("responderName"),
    responderRole: readString("responderRole"),
    responderPhone: readString("responderPhone"),
  };
}

const ROLE_LABELS: Record<string, string> = {
  HEADMAN: "ผู้ใหญ่บ้าน",
  ASSISTANT_HEADMAN: "ผู้ช่วยผู้ใหญ่บ้าน",
  DEPUTY_HEADMAN: "ผู้ช่วยผู้ใหญ่บ้าน",
  ADMIN: "เจ้าหน้าที่",
  STAFF: "เจ้าหน้าที่",
  SUPERADMIN: "ผู้ดูแลระบบสูงสุด",
  COMMITTEE: "คณะกรรมการหมู่บ้าน",
  RESIDENT: "ลูกบ้าน",
};

const TIMELINE_ACTION_LABELS: Record<string, string> = {
  CREATED: "สร้างคำขอนัดหมาย",
  UPDATED: "แก้ไขนัดหมาย",
  TIME_SUGGESTED: "เสนอวันเวลา",
  APPROVED: "ยืนยันนัดหมาย",
  REJECTED: "ปฏิเสธคำขอนัดหมาย",
  CANCELLED: "ยกเลิกนัดหมาย",
  TIME_CHANGE_REQUESTED: "ขอให้เสนอเวลาใหม่",
};

function roleLabel(role?: string | null) {
  return role ? ROLE_LABELS[role] ?? "เจ้าหน้าที่" : "เจ้าหน้าที่";
}

function reasonFromEntry(entry: { metadata: Prisma.JsonValue | null; description: string | null } | undefined) {
  if (!entry) return null;
  const metadata = readAppointmentMetadata(entry.metadata);
  if (metadata.reason) return metadata.reason;
  const separatorIndex = entry.description?.lastIndexOf(" - ") ?? -1;
  return separatorIndex >= 0 ? entry.description?.slice(separatorIndex + 3).trim() || null : null;
}

async function fetchAppointment(appointmentId: string) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    redirect("/auth/login");
  }
  const membership = getResidentMembership(session);
  if (!membership) {
    redirect("/resident/dashboard");
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      slot: true,
      timeline: {
        orderBy: { createdAt: "desc" },
        include: {
          actor: {
            select: {
              name: true,
              memberships: {
                where: { villageId: membership.villageId, status: "ACTIVE" },
                select: { role: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  if (!appointment) {
    redirect("/resident/appointments");
  }

  if (appointment.userId !== session.id) {
    redirect("/resident/appointments");
  }

  return appointment;
}

export default async function AppointmentDetailPage({ params, searchParams }: PageProps) {
  const { appointmentId } = await params;
  const query = searchParams ? await searchParams : {};
  const appointment = await fetchAppointment(appointmentId);
  const validCalendarReturn = query.from === "calendar" && /^\d{4}-\d{2}$/.test(query.month ?? "") && /^\d{4}-\d{2}-\d{2}$/.test(query.date ?? "") && query.date?.startsWith(`${query.month}-`);
  const backHref = validCalendarReturn ? `/resident/calendar?month=${query.month}&date=${query.date}` : "/resident/appointments";
  const backLabel = validCalendarReturn ? "กลับไปปฏิทิน" : "กลับรายการนัดหมาย";

  // Find the latest TIME_SUGGESTED timeline entry for admin message
  const suggestionEntry = appointment.timeline.find((t) => t.action === "TIME_SUGGESTED");
  const suggestionMetadata = readAppointmentMetadata(suggestionEntry?.metadata ?? null);
  const createdEntry = appointment.timeline.find((t) => t.action === "CREATED");
  const createdMetadata = readAppointmentMetadata(createdEntry?.metadata ?? null);
  const responderEntry = appointment.timeline.find((t) =>
    t.action === "APPROVED" || t.action === "REJECTED" || t.action === "TIME_SUGGESTED"
  );
  const responderMetadata = readAppointmentMetadata(responderEntry?.metadata ?? null);
  const adminCreatedEntry = appointment.timeline.find((entry) => readAppointmentMetadata(entry.metadata).adminCreated);
  const adminCreatedMetadata = readAppointmentMetadata(adminCreatedEntry?.metadata ?? null);
  const creatorName = adminCreatedMetadata.creatorName ?? adminCreatedEntry?.actor?.name ?? null;
  const creatorRole = adminCreatedMetadata.creatorRole ?? adminCreatedEntry?.actor?.memberships[0]?.role ?? null;
  const cancellationEntry = appointment.timeline.find((entry) => entry.action === "CANCELLED" || entry.action === "REJECTED");
  const isRejected = appointment.stage === "REJECTED";
  const hasCancellationNotice = appointment.stage === "CANCELLED" || isRejected || Boolean(appointment.reviewNote) && Boolean(cancellationEntry);
  const cancellationReason = appointment.reviewNote ?? reasonFromEntry(cancellationEntry) ?? null;

  // Find if last rejection was a rejected suggestion
  const lastTimeline = appointment.timeline[0];
  const wasRejectedSuggestion: boolean =
    appointment.stage === "CANCELLED" &&
    lastTimeline?.action === "CANCELLED" &&
    (lastTimeline?.description?.includes("ปฏิเสธเวลาที่ผู้บริหารแนะนำ") ?? false);

  return (
    <div className="max-w-2xl space-y-6">
      <Link href={backHref} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </Link>

      {adminCreatedEntry && (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 sm:p-5" aria-label="ที่มาของนัดหมาย">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="font-semibold text-blue-950">นัดหมายนี้ถูกสร้างโดยฝ่ายผู้ดูแลหมู่บ้าน</h2>
              <p className="mt-1 text-sm leading-6 text-blue-900">
                <span className="font-medium">{creatorName ?? "เจ้าหน้าที่หมู่บ้าน"}</span> ({roleLabel(creatorRole)}) ได้สร้างนัดหมายนี้และเสนอวันเวลาให้คุณยืนยัน
              </p>
              <p className="mt-1 text-sm text-blue-800">สร้างเมื่อ {formatThaiDate(adminCreatedEntry.createdAt)}</p>
              {adminCreatedMetadata.adminMessage && <p className="mt-3 rounded-lg bg-white/70 p-3 text-sm text-blue-950">หมายเหตุจากผู้สร้าง: {adminCreatedMetadata.adminMessage}</p>}
            </div>
          </div>
        </section>
      )}

      {hasCancellationNotice && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4 sm:p-5" role="alert">
          <div className="flex items-start gap-3">
            {isRejected ? <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />}
            <div className="min-w-0">
              <h2 className="font-semibold text-red-950">{isRejected ? "คำขอนัดหมายถูกปฏิเสธ" : "นัดหมายถูกยกเลิก"}</h2>
              <p className="mt-2 text-sm leading-6 text-red-900"><span className="font-medium">เหตุผล{isRejected ? "ที่ปฏิเสธ" : "การยกเลิก"}: </span>{cancellationReason ?? "ยังไม่มีการระบุเหตุผล"}</p>
            </div>
          </div>
        </section>
      )}

      {/* Main Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 space-y-4">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="text-xl font-bold text-gray-900">{appointment.title}</h1>
          <Badge className="self-start" variant={stageVariant[appointment.stage] ?? "default"}>
            {APPOINTMENT_STAGE_LABELS[appointment.stage]}
          </Badge>
        </div>

        {appointment.description && (
          <div className="text-sm text-gray-600">
            <p className="text-gray-500 font-medium">รายละเอียด</p>
            <p className="mt-1">{appointment.description}</p>
          </div>
        )}

        <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
          {createdMetadata?.targetAdminName && (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-gray-500">ผู้รับนัดที่เลือก</span>
              <span className="font-medium">
                {createdMetadata.targetAdminName}
                {createdMetadata.targetAdminRole ? ` (${roleLabel(createdMetadata.targetAdminRole)})` : ""}
                {createdMetadata.targetAdminPhone ? ` • ${createdMetadata.targetAdminPhone}` : ""}
              </span>
            </div>
          )}
          {appointment.slot && (
            <>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-gray-500">วันที่นัด</span>
                <span className="font-medium">{formatThaiDate(appointment.slot.date)}</span>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-gray-500">เวลา</span>
                <span className="font-medium">{appointment.slot.startTime} - {appointment.slot.endTime}</span>
              </div>
            </>
          )}
          {!appointment.slot && appointment.stage !== "CANCELLED" && appointment.stage !== "REJECTED" && (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-gray-500">สถานะ</span>
              <span className="font-medium text-orange-600">รอการแนะนำเวลา</span>
            </div>
          )}
          <div className="flex flex-col gap-1 border-t border-gray-200 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-gray-500">สร้างเมื่อ</span>
            <span className="font-medium">{formatThaiDate(appointment.createdAt)}</span>
          </div>
          {responderMetadata?.responderName && (
            <div className="flex flex-col gap-1 border-t border-gray-200 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-gray-500">ผู้ตอบกลับล่าสุด</span>
              <span className="font-medium">
                {responderMetadata.responderName}
                {responderMetadata.responderRole ? ` (${roleLabel(responderMetadata.responderRole)})` : ""}
                {responderMetadata.responderPhone ? ` • ${responderMetadata.responderPhone}` : ""}
              </span>
            </div>
          )}
        </div>

        {appointment.reviewNote && appointment.stage !== "TIME_SUGGESTED" && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-900">หมายเหตุจากผู้บริหาร</p>
            <p className="text-sm text-blue-800 mt-2">{appointment.reviewNote}</p>
          </div>
        )}
      </div>

      {/* Stage-specific actions (client component) */}
      <AppointmentActions
        appointmentId={appointment.id}
        stage={appointment.stage}
        suggestionMessage={suggestionMetadata?.adminMessage ?? appointment.reviewNote ?? null}
        wasRejectedSuggestion={wasRejectedSuggestion}
      />

      {/* Timeline */}
      {appointment.timeline && appointment.timeline.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">ประวัติการดำเนินการ</h2>
          <div className="space-y-3">
            {appointment.timeline.map((entry, idx) => (
              <div key={entry.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  {idx < appointment.timeline.length - 1 && (
                    <div className="w-0.5 h-12 bg-gray-200 my-1"></div>
                  )}
                </div>
                <div className="flex-1 pb-2">
                  <p className="font-medium text-sm text-gray-900">{TIMELINE_ACTION_LABELS[entry.action] ?? "อัปเดตนัดหมาย"}</p>
                  {entry.description && (
                    <p className="text-xs text-gray-600 mt-1">{entry.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{formatThaiDate(entry.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
