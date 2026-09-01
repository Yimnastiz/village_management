import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { CalendarRequestReviewActions } from "./calendar-request-review-actions";

export default async function Page({ params }: { params: Promise<{ villageId: string }> }) {
  const { villageId } = await params;
  const [village, requests] = await Promise.all([prisma.village.findUniqueOrThrow({ where: { id: villageId }, select: { name: true } }), prisma.villageEventSubmission.findMany({ where: { villageId, status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { requester: { select: { name: true } } } })]);
  const base = `/superadmin/villages/${villageId}/calendar`;
  return <div className="space-y-5"><SuperAdminPageHeaderRegistration priority={1} context={{ title: "คำขอกิจกรรม", description: `พิจารณาคำขอกิจกรรมของ ${village.name} เพื่อการสนับสนุนงานหมู่บ้าน` }} /><Link href={base} className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900">← กลับปฏิทิน</Link><section className="overflow-hidden rounded-xl border border-gray-200 bg-white">{requests.length ? requests.map((request) => <article key={request.id} className="space-y-3 border-b border-gray-100 p-4 last:border-b-0"><div><div className="flex flex-wrap items-start gap-2"><h2 className="min-w-0 break-words font-semibold">{request.title}</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{request.type}</span></div><p className="mt-1 text-sm text-slate-600">ผู้ขอ: {request.requester.name || "ไม่ระบุ"}</p>{request.description ? <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{request.description}</p> : null}</div><CalendarRequestReviewActions villageId={villageId} requestId={request.id} initialIsPublic={request.isPublic} /></article>) : <p className="p-8 text-center text-sm text-slate-500">ไม่มีคำขอกิจกรรมที่รอพิจารณา</p>}</section></div>;
}
