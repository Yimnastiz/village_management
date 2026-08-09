import { notFound, redirect } from "next/navigation";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { CalendarRequestForm } from "../../request-form";

function toInput(value: Date | null) { return value ? new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""; }

export default async function EditResidentCalendarRequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const session = await getSessionContextFromServerCookies(); if (!session?.id) redirect("/auth/login");
  const membership = getResidentMembership(session); if (!membership) redirect("/resident/dashboard");
  const request = await prisma.villageEventSubmission.findFirst({ where: { id: requestId, requesterId: session.id, villageId: membership.villageId, status: { in: ["PENDING", "APPROVED"] }, type: "CREATE" }, select: { id: true, status: true, title: true, description: true, location: true, startsAt: true, endsAt: true, isPublic: true } });
  if (!request) notFound();
  return <main className="mx-auto w-full max-w-3xl space-y-5"><div><h1 className="text-2xl font-bold text-gray-900">แก้ไขคำขอกิจกรรม</h1><p className="mt-1 text-sm text-gray-500">{request.status === "APPROVED" ? "ส่งรายละเอียดใหม่ให้ผู้ใหญ่บ้านพิจารณาก่อนนำไปใช้" : "แก้ไขได้จนกว่าผู้ใหญ่บ้านจะเริ่มพิจารณา"}</p></div><CalendarRequestForm requestId={request.id} approved={request.status === "APPROVED"} initialValues={{ title: request.title, description: request.description ?? "", location: request.location ?? "", startsAt: toInput(request.startsAt), endsAt: toInput(request.endsAt), visibility: request.isPublic ? "PUBLIC" : "RESIDENT" }} /></main>;
}
