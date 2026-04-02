import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APPOINTMENT_STAGE_LABELS } from "@/lib/constants";
import { formatThaiDate } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { redirect } from "next/navigation";
import { AppointmentActions } from "./appointment-actions";

interface PageProps { 
  params: Promise<{ appointmentId: string }> 
}

const stageVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING_APPROVAL: "warning",
  TIME_SUGGESTED: "info",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "default",
  COMPLETED: "info",
};

async function fetchAppointment(appointmentId: string) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    redirect("/auth/login");
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      slot: true,
      timeline: {
        orderBy: { createdAt: "desc" },
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

export default async function AppointmentDetailPage({ params }: PageProps) {
  const { appointmentId } = await params;
  const appointment = await fetchAppointment(appointmentId);

  // Find the latest TIME_SUGGESTED timeline entry for admin message
  const suggestionEntry = appointment.timeline.find((t) => t.action === "TIME_SUGGESTED");
  const suggestionMetadata = suggestionEntry?.metadata as any;

  // Find if last rejection was a rejected suggestion
  const lastTimeline = appointment.timeline[0];
  const wasRejectedSuggestion: boolean =
    appointment.stage === "CANCELLED" &&
    lastTimeline?.action === "CANCELLED" &&
    (lastTimeline?.description?.includes("ปฏิเสธเวลาที่ผู้บริหารแนะนำ") ?? false);

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/resident/appointments" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> กลับรายการนัดหมาย
      </Link>

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
                  <p className="font-medium text-sm text-gray-900">{entry.action}</p>
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
