import Link from "next/link";
import { ArrowLeft, CalendarDays, Globe2, Users } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { VILLAGE_EVENT_SUBMISSION_STATUS_LABELS } from "@/lib/constants";
import { resolveApprovedSubmissionEvent } from "@/lib/calendar-submission-event";
import { prisma } from "@/lib/prisma";
import { getVillagePermissionContext } from "@/lib/admin-permission.server";
import { formatCalendarPerson } from "@/lib/calendar-person";
import { CalendarRequestReviewButtons } from "../request-review-buttons";
import { CalendarRequestManagementActions } from "../request-management-actions";
import { RESIDENT_ACTOR_USER_SELECT, residentActorDisplay } from "@/lib/resident-actor-display";
import { DeleteVillageEventButton } from "../../[eventId]/delete-button";

type AdminCalendarRequestDetailPageProps = {
  params: Promise<{ requestId: string }>;
};

const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export default async function AdminCalendarRequestDetailPage({ params }: AdminCalendarRequestDetailPageProps) {
  const { requestId } = await params;

  const context = await getVillagePermissionContext("calendar.requests.review");
  const membership = context?.membership;
  if (!membership) redirect("/auth/login");

  const requestRow = await prisma.villageEventSubmission.findFirst({
    where: {
      id: requestId,
      villageId: membership.villageId,
    },
    select: {
      id: true,
      type: true,
      status: true,
      eventId: true,
      isPublic: true,
      title: true,
      description: true,
      location: true,
      startsAt: true,
      endsAt: true,
      reviewedBy: true,
      reviewedAt: true,
      reviewNote: true,
      requester: { select: RESIDENT_ACTOR_USER_SELECT },
    },
  });

  if (!requestRow) notFound();
  const requesterDisplay = residentActorDisplay(requestRow.requester, { villageId: membership.villageId });
  const request = { ...requestRow, requester: { name: requesterDisplay.label, phoneNumber: requesterDisplay.contactPhone ?? "-" } };
  const publishedEvent = request.status === "APPROVED" && request.type === "CREATE"
    ? await resolveApprovedSubmissionEvent({ ...request, villageId: membership.villageId })
    : null;

  const reviewer = request.reviewedBy
    ? await prisma.user.findUnique({
        where: { id: request.reviewedBy },
        select: {
          name: true,
          memberships: {
            where: { villageId: membership.villageId, status: "ACTIVE" },
            select: { role: true },
            take: 1,
          },
        },
      })
    : null;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6">
      <Link
        href="/admin/calendar/requests"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> กลับรายการคำขอ
      </Link>

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant[request.status] ?? "default"}>
            {VILLAGE_EVENT_SUBMISSION_STATUS_LABELS[request.status] ?? request.status}
          </Badge>
          <Badge variant="outline">
            การมองเห็นที่ขอ: {request.isPublic ? <><Globe2 className="mx-1 h-3.5 w-3.5" aria-hidden="true" />สาธารณะ</> : <><Users className="mx-1 h-3.5 w-3.5" aria-hidden="true" />เฉพาะสมาชิก</>}
          </Badge>
        </div>

        <p className="text-sm text-gray-600">
          ผู้ส่งคำขอ: {request.requester.name} ({request.requester.phoneNumber})
        </p>

        <h1 className="break-words text-2xl font-bold text-gray-900">{request.title}</h1>

        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          <div>
            <p className="text-gray-500">สถานที่</p>
            <p className="mt-1 text-gray-900">{request.location || "ไม่ระบุ"}</p>
          </div>
          <div>
            <p className="text-gray-500">วันเวลาเริ่ม</p>
            <p className="mt-1 text-gray-900">{new Date(request.startsAt).toLocaleString("th-TH")}</p>
          </div>
          <div>
            <p className="text-gray-500">วันเวลาสิ้นสุด</p>
            <p className="mt-1 text-gray-900">{request.endsAt ? new Date(request.endsAt).toLocaleString("th-TH") : "ไม่ระบุ"}</p>
          </div>
        </div>

        {request.description && (
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="whitespace-pre-wrap leading-7 text-gray-700">{request.description}</p>
          </div>
        )}

        {request.status === "PENDING" ? (
          <div className="space-y-4 border-t border-gray-100 pt-4">
            <CalendarRequestReviewButtons requestId={request.id} requestedVisibility={request.isPublic ? "PUBLIC" : "RESIDENT"} />
            <CalendarRequestManagementActions requestId={request.id} />
          </div>
        ) : (
          <div className="text-sm text-gray-600">
            <p>
              ผู้พิจารณา: {request.reviewedBy ? formatCalendarPerson(reviewer, "ไม่พบข้อมูลผู้พิจารณา") : "ยังไม่มีผู้พิจารณา"} • {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString("th-TH") : "-"}
            </p>
            {request.reviewNote && <p className="mt-1">หมายเหตุ: {request.reviewNote}</p>}
          </div>
        )}
        {publishedEvent ? <div className="flex flex-wrap items-start gap-2"><Link href={`/admin/calendar/${publishedEvent.id}`} className="inline-flex h-10 w-fit items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"><CalendarDays className="h-4 w-4" aria-hidden="true" />ดูกิจกรรมที่เผยแพร่</Link><DeleteVillageEventButton eventId={publishedEvent.id} isResidentOwned={Boolean(publishedEvent.createdById && publishedEvent.createdById !== context.session.id)} /></div> : null}
      </div>
    </main>
  );
}
