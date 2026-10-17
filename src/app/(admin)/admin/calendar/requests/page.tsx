import Link from "next/link";
import { CalendarDays, FileClock, Globe2, MapPin, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { VILLAGE_EVENT_SUBMISSION_STATUS_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getVillagePermissionContext } from "@/lib/admin-permission.server";
import { RESIDENT_ACTOR_USER_SELECT, residentActorDisplay } from "@/lib/resident-actor-display";
import { PageBackLink } from "@/components/ui/page-back-link";

const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

function formatEventSchedule(startsAt: Date, endsAt: Date | null) {
  const options = { timeZone: "Asia/Bangkok" };
  const formatDate = (value: Date) => value.toLocaleDateString("th-TH", { ...options, day: "numeric", month: "short", year: "numeric" });
  const formatTime = (value: Date) => value.toLocaleTimeString("th-TH", { ...options, hour: "2-digit", minute: "2-digit" });
  if (!endsAt) return `${formatDate(startsAt)} เวลา ${formatTime(startsAt)} น.`;
  const sameDate = startsAt.toLocaleDateString("en-CA", options) === endsAt.toLocaleDateString("en-CA", options);
  return sameDate
    ? `${formatDate(startsAt)} เวลา ${formatTime(startsAt)}–${formatTime(endsAt)} น.`
    : `${formatDate(startsAt)} ${formatTime(startsAt)} – ${formatDate(endsAt)} ${formatTime(endsAt)} น.`;
}

export default async function AdminCalendarRequestListPage() {
  const context = await getVillagePermissionContext("calendar.requests.review");
  const membership = context?.membership;
  if (!membership) redirect("/auth/login");

  const requestRows = await prisma.villageEventSubmission.findMany({
    where: { villageId: membership.villageId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      isPublic: true,
      title: true,
      startsAt: true,
      endsAt: true,
      location: true,
      createdAt: true,
      requester: { select: RESIDENT_ACTOR_USER_SELECT },
    },
  });
  const requests = requestRows.map((request) => {
    const display = residentActorDisplay(request.requester, { villageId: membership.villageId });
    return { ...request, requester: { name: display.label, phoneNumber: display.contactPhone ?? "-" } };
  });

  return (
    <div className="space-y-3">
      <PageBackLink href="/admin/calendar" label="กลับปฏิทิน" />
      {requests.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <FileClock className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-gray-600">ยังไม่มีคำขอกิจกรรม</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <Link
              key={request.id}
              href={`/admin/calendar/requests/${request.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-4 transition hover:border-gray-300 hover:shadow-sm sm:p-5"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant={statusVariant[request.status] ?? "default"}>
                      {VILLAGE_EVENT_SUBMISSION_STATUS_LABELS[request.status] ?? request.status}
                    </Badge>
                    <Badge variant="outline">
                      {request.isPublic ? <><Globe2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />สาธารณะ</> : <><Users className="mr-1 h-3.5 w-3.5" aria-hidden="true" />เฉพาะสมาชิก</>}
                    </Badge>
                  </div>
                  <p className="font-semibold text-gray-900">{request.title}</p>
                  <p className="mt-2 flex items-start gap-1.5 text-sm text-gray-600"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{formatEventSchedule(request.startsAt, request.endsAt)}</p>
                  {request.location ? <p className="mt-1 flex items-start gap-1.5 text-sm text-gray-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{request.location}</p> : null}
                  <p className="mt-2 text-sm text-gray-500">
                    ผู้ส่งคำขอ: {request.requester.name} ({request.requester.phoneNumber})
                  </p>
                </div>
                <time className="shrink-0 whitespace-nowrap text-xs text-gray-400">ส่งเมื่อ {request.createdAt.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" })}</time>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
