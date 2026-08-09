import { notFound, redirect } from "next/navigation";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { CalendarRequestForm } from "../../request-form";

type RequestRecord = { id: string; status: string; title: string; description: string | null; location: string | null; startsAt: Date; endsAt: Date | null; isPublic: boolean };
type Delegate = { findFirst(args: unknown): Promise<RequestRecord | null> };

function toInput(value: Date | null) { return value ? new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""; }

export default async function EditResidentCalendarRequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const session = await getSessionContextFromServerCookies(); if (!session?.id) redirect("/auth/login");
  const membership = getResidentMembership(session); if (!membership) redirect("/resident/dashboard");
  const request = await (prisma as unknown as { villageEventSubmission: Delegate }).villageEventSubmission.findFirst({ where: { id: requestId, requesterId: session.id, villageId: membership.villageId, status: "PENDING" } });
  if (!request) notFound();
  return <main className="mx-auto w-full max-w-3xl space-y-5"><div><h1 className="text-2xl font-bold text-gray-900">แก้ไขคำขอกิจกรรม</h1><p className="mt-1 text-sm text-gray-500">แก้ไขได้จนกว่าผู้ใหญ่บ้านจะเริ่มพิจารณา</p></div><CalendarRequestForm requestId={request.id} initialValues={{ title: request.title, description: request.description ?? "", location: request.location ?? "", startsAt: toInput(request.startsAt), endsAt: toInput(request.endsAt), visibility: request.isPublic ? "PUBLIC" : "RESIDENT" }} /></main>;
}
