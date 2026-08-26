import { notFound, redirect } from "next/navigation";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { resolveApprovedSubmissionEvent } from "@/lib/calendar-submission-event";
import { prisma } from "@/lib/prisma";
import { CalendarRequestForm } from "../../request-form";

function toInput(value: Date | null) {
  return value ? new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
}

export default async function EditResidentCalendarRequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  const membership = getResidentMembership(session);
  if (!membership) redirect("/resident/dashboard");

  const request = await prisma.villageEventSubmission.findFirst({
    where: { id: requestId, requesterId: session.id, villageId: membership.villageId, status: { in: ["PENDING", "APPROVED"] }, type: "CREATE" },
    select: { id: true, villageId: true, eventId: true, status: true, title: true, description: true, location: true, startsAt: true, endsAt: true, isPublic: true },
  });
  if (!request) notFound();

  const approved = request.status === "APPROVED";
  const linkedEvent = approved ? await resolveApprovedSubmissionEvent(request) : null;
  if (approved && !linkedEvent) {
    return <main className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">แก้ไขคำขอกิจกรรม</h1>
        <p className="mt-1 text-sm text-gray-500">รายการนี้ได้รับอนุมัติแล้ว</p>
      </div>
      <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">ไม่พบกิจกรรมที่ต้องการแก้ไข กรุณาติดต่อผู้ใหญ่บ้าน</p>
    </main>;
  }
  const values = linkedEvent ?? request;

  return <main className="mx-auto w-full max-w-3xl space-y-5">
    <div>
      <h1 className="text-2xl font-bold text-gray-900">แก้ไขคำขอกิจกรรม</h1>
      <p className="mt-1 text-sm text-gray-500">{approved ? "รายการนี้ได้รับอนุมัติแล้ว การแก้ไขจะมีผลหลังผู้ใหญ่บ้านอนุมัติคำขอแก้ไข" : "แก้ไขคำขอกิจกรรมของคุณ"}</p>
    </div>
    <CalendarRequestForm requestId={request.id} approved={approved} cancelHref={`/resident/calendar/requests/${request.id}`} initialValues={{ title: values.title, description: values.description ?? "", location: values.location ?? "", startsAt: toInput(values.startsAt), endsAt: toInput(values.endsAt), visibility: values.isPublic ? "PUBLIC" : "RESIDENT" }} />
  </main>;
}
