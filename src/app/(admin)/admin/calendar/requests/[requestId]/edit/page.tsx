import { notFound, redirect } from "next/navigation";
import { getHeadmanMembership, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { CalendarRequestEditForm } from "../../request-edit-form";

function toDatetimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function EditCalendarRequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = getHeadmanMembership(session);
  if (!membership) redirect("/admin/calendar/requests");

  const request = await prisma.villageEventSubmission.findFirst({
    where: { id: requestId, villageId: membership.villageId, status: "PENDING" },
    select: { id: true, title: true, description: true, location: true, startsAt: true, endsAt: true, isPublic: true },
  });
  if (!request) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">แก้ไขคำขอกิจกรรม</h1>
        <p className="mt-1 text-sm text-gray-500">ปรับรายละเอียดคำขอที่ยังรอการพิจารณา</p>
      </div>
      <CalendarRequestEditForm
        requestId={request.id}
        defaultValues={{
          title: request.title,
          description: request.description ?? "",
          location: request.location ?? "",
          startsAt: toDatetimeLocalValue(request.startsAt),
          endsAt: request.endsAt ? toDatetimeLocalValue(request.endsAt) : "",
          isPublic: request.isPublic ? "PUBLIC" : "RESIDENT",
        }}
      />
    </main>
  );
}
