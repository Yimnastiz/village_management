import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ImageCarousel } from "@/components/ui/image-carousel";
import { NEWS_STAGE_LABELS, NEWS_SUBMISSION_STATUS_LABELS, NEWS_VISIBILITY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getAdminMembership, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { formatThaiDateTime } from "@/lib/date-format";
import { newsSubmissionTypeLabel, parseNewsSubmissionPayload } from "@/lib/news-submission";
import { getVillageReviewerDisplay } from "@/lib/village-reviewer";
import { RequestReviewButtons } from "../request-review-buttons";

interface PageProps { params: Promise<{ requestId: string }> }

export default async function AdminNewsRequestDetailPage({ params }: PageProps) {
  const { requestId } = await params;
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");
  const membership = getAdminMembership(session);
  if (!membership) redirect("/auth/login");

  const request = await prisma.newsSubmission.findFirst({ where: { id: requestId, villageId: membership.villageId }, include: { requester: { select: { name: true, phoneNumber: true } }, targetNews: { select: { id: true, title: true } } } });
  if (!request) notFound();
  const payload = parseNewsSubmissionPayload(request.payload);
  const reviewer = request.status !== "PENDING" ? await getVillageReviewerDisplay(request.reviewedBy, membership.villageId) : null;
  const title = payload?.title || request.targetNews?.title || "-";

  return <div className="mx-auto w-full max-w-4xl space-y-4 px-0 sm:space-y-6"><Link href="/admin/news/requests" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" />กลับรายการคำขอ</Link><div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6 lg:p-8"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{newsSubmissionTypeLabel(request.type, payload)}</Badge><Badge variant={request.status === "PENDING" ? "warning" : request.status === "APPROVED" ? "success" : "danger"}>{NEWS_SUBMISSION_STATUS_LABELS[request.status]}</Badge></div>{payload?.isDeleteRequest ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">คำเตือน: ลูกบ้านต้องการลบข่าวนี้ หากอนุมัติ ข่าวจะถูกลบออกจากฐานข้อมูลและหน้าเว็บไซต์อย่างถาวร</div> : null}<div><p className="text-sm text-gray-600">ผู้ส่งคำขอ: {request.requester.name} · {request.requester.phoneNumber}</p>{request.targetNews?.title ? <p className="mt-1 text-sm text-gray-600">ข่าวปลายทาง: {request.targetNews.title}</p> : null}</div><h1 className="text-2xl font-bold text-gray-900">{title}</h1><div className="flex flex-wrap gap-2"><Badge variant="outline">{NEWS_STAGE_LABELS[payload?.stage ?? "DRAFT"] ?? payload?.stage ?? "DRAFT"}</Badge><Badge variant="outline">{NEWS_VISIBILITY_LABELS[payload?.visibility ?? "PUBLIC"] ?? payload?.visibility ?? "PUBLIC"}</Badge>{payload?.isPinned ? <Badge variant="warning">ขอปักหมุด</Badge> : null}</div>{payload?.summary ? <p className="text-sm text-gray-600">{payload.summary}</p> : null}{payload?.imageUrls.length ? <ImageCarousel images={payload.imageUrls} altPrefix={title} /> : null}<div className="rounded-lg border border-gray-100 bg-gray-50 p-4"><p className="break-words whitespace-pre-wrap leading-7 text-gray-700">{payload?.content || "-"}</p></div>{request.status === "PENDING" ? <RequestReviewButtons requestId={request.id} /> : <div className="grid gap-3 border-t border-gray-100 pt-3 text-sm text-gray-600 sm:grid-cols-2"><div><p className="text-gray-500">ผู้พิจารณา</p><p className="mt-1 font-medium text-gray-800">{reviewer?.label ?? "ผู้ดูแลหมู่บ้าน"}</p></div><div><p className="text-gray-500">พิจารณาเมื่อ</p><p className="mt-1 font-medium text-gray-800">{request.reviewedAt ? formatThaiDateTime(request.reviewedAt) : "-"}</p></div>{request.reviewNote ? <p className="sm:col-span-2">หมายเหตุ: {request.reviewNote}</p> : null}</div>}</div></div>;
}
