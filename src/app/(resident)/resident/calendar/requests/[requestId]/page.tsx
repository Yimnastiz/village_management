import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { VILLAGE_EVENT_SUBMISSION_STATUS_LABELS, VILLAGE_EVENT_VISIBILITY_LABELS } from "@/lib/constants";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

type Detail = { id: string; status: string; isPublic: boolean; title: string; description: string | null; location: string | null; startsAt: Date; endsAt: Date | null; reviewedBy: string | null; reviewedAt: Date | null; reviewNote: string | null; createdAt: Date };
type Delegate = { findFirst(args: unknown): Promise<Detail | null> };
const variants: Record<string, "default" | "success" | "warning" | "danger"> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" };
export default async function ResidentCalendarRequestDetailPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params; const session = await getSessionContextFromServerCookies(); if (!session?.id) redirect("/auth/login"); const membership = getResidentMembership(session); if (!membership) redirect("/resident/dashboard");
  const request = await (prisma as unknown as { villageEventSubmission: Delegate }).villageEventSubmission.findFirst({ where: { id: requestId, requesterId: session.id, villageId: membership.villageId } }); if (!request) notFound();
  const reviewer = request.reviewedBy ? await prisma.user.findUnique({ where: { id: request.reviewedBy }, select: { name: true } }) : null;
  return <main className="mx-auto w-full max-w-4xl space-y-6"><Link href="/resident/calendar/requests" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" /> กลับรายการคำขอ</Link><article className="space-y-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"><div className="flex flex-wrap gap-2"><Badge variant={variants[request.status] ?? "default"}>{VILLAGE_EVENT_SUBMISSION_STATUS_LABELS[request.status] ?? request.status}</Badge><Badge variant="outline">{VILLAGE_EVENT_VISIBILITY_LABELS[request.isPublic ? "PUBLIC" : "RESIDENT"]}</Badge></div><h1 className="break-words text-2xl font-bold text-gray-900">{request.title}</h1>{request.description ? <p className="whitespace-pre-wrap leading-7 text-gray-700">{request.description}</p> : null}<div className="grid gap-4 text-sm sm:grid-cols-2"><Info label="วันและเวลาเริ่ม" value={request.startsAt.toLocaleString("th-TH")} /><Info label="วันและเวลาสิ้นสุด" value={request.endsAt?.toLocaleString("th-TH") ?? "ไม่ระบุ"} /><Info label="สถานที่" value={request.location ?? "ไม่ระบุ"} /><Info label="วันที่ส่งคำขอ" value={request.createdAt.toLocaleString("th-TH")} /></div>{(request.reviewNote || reviewer || request.reviewedAt) ? <div className="border-t border-gray-100 pt-4 text-sm text-gray-700"><p>ผู้พิจารณา: {reviewer?.name ?? "-"}</p>{request.reviewedAt ? <p className="mt-1">วันที่พิจารณา: {request.reviewedAt.toLocaleString("th-TH")}</p> : null}{request.reviewNote ? <p className="mt-1">เหตุผล/หมายเหตุ: {request.reviewNote}</p> : null}</div> : null}</article></main>;
}
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-gray-500">{label}</p><p className="mt-1 text-gray-900">{value}</p></div>; }
