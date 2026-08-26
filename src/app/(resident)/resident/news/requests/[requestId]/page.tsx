import Link from "next/link";
import { Globe2, Users } from "lucide-react";
import { Prisma } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PageBackLink } from "@/components/ui/page-back-link";
import { NEWS_SUBMISSION_STATUS_LABELS, NEWS_SUBMISSION_TYPE_LABELS } from "@/lib/constants";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { ImageCarousel } from "@/components/ui/image-carousel";
import { ResidentNewsRequestActions } from "./resident-news-request-actions";

interface PageProps { params: Promise<{ requestId: string }>; }

const statusVariant = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" } as const;

export default async function ResidentNewsRequestDetailPage({ params }: PageProps) {
  const { requestId } = await params;
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  const membership = getResidentMembership(session);
  if (!membership) redirect("/resident/dashboard");

  const request = await prisma.newsSubmission.findFirst({
    where: { id: requestId, requesterId: session.id, villageId: membership.villageId },
    include: { targetNews: { select: { id: true, title: true, authorId: true, stage: true } } },
  });
  if (!request) notFound();

  const payload = request.payload as Prisma.JsonObject;
  const imageUrls = Array.isArray(payload.imageUrls) ? payload.imageUrls.map((value) => String(value)).filter(Boolean) : [];
  const visibility = String(payload.visibility ?? "PUBLIC");
  const isDeleteRequest = payload.isDeleteRequest === true;
  const isPending = request.status === "PENDING";
  const editable = isPending && !isDeleteRequest;
  const deletable = isPending && (request.type === "CREATE" || request.type === "UPDATE");
  const liveTarget = request.type === "CREATE" && request.status === "APPROVED" && request.targetNews?.authorId === session.id && request.targetNews.stage === "PUBLISHED" ? request.targetNews : null;
  const requestType = isDeleteRequest ? "คำขอลบข่าว" : NEWS_SUBMISSION_TYPE_LABELS[request.type];
  const deleteReason = typeof payload.deleteReason === "string" ? payload.deleteReason.trim() : "";

  return <div className="mx-auto w-full max-w-4xl space-y-4 sm:space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
      <PageBackLink href="/resident/news/requests" label="กลับรายการคำขอ" />
      <ResidentNewsRequestActions requestId={request.id} editable={editable} deletable={deletable} liveNewsId={liveTarget?.id} />
    </div>

    <article className="space-y-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-6 lg:p-8">
      <header>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <Badge variant={statusVariant[request.status]}>{NEWS_SUBMISSION_STATUS_LABELS[request.status]}</Badge>
          <span className="text-sm text-gray-500">{requestType}</span>
        </div>
        <h1 className="mt-3 break-words text-2xl font-bold text-gray-900">{String(payload.title ?? "-")}</h1>
        <p className="mt-1 text-sm text-gray-500">ส่งเมื่อ {request.createdAt.toLocaleDateString("th-TH")}</p>
      </header>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
        {visibility === "RESIDENT_ONLY" ? <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" aria-hidden="true" />เฉพาะลูกบ้าน</span> : <span className="inline-flex items-center gap-1.5"><Globe2 className="h-4 w-4" aria-hidden="true" />สาธารณะ</span>}
        {Boolean(payload.isPinned) ? <span>ขอปักหมุด</span> : null}
      </div>

      {liveTarget ? <Link href={`/resident/news/${liveTarget.id}`} className="inline-flex text-sm font-medium text-green-700 hover:text-green-800 focus:outline-none focus:ring-2 focus:ring-green-500">ดูข่าวที่เผยแพร่แล้ว</Link> : null}
      {!liveTarget && request.targetNews?.title ? <p className="text-sm text-gray-600">ข่าวที่อ้างอิง: {request.targetNews.title}</p> : null}
      {String(payload.summary ?? "").trim() ? <p className="text-sm text-gray-600">{String(payload.summary)}</p> : null}
      {imageUrls.length > 0 ? <ImageCarousel images={imageUrls} altPrefix={String(payload.title ?? "news")} thumbnailBehavior="select" /> : null}
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4"><p className="break-words whitespace-pre-wrap leading-7 text-gray-700">{String(payload.content ?? "-")}</p></div>
      {isDeleteRequest && deleteReason ? <section className="rounded-lg border border-rose-100 bg-rose-50 p-4"><h2 className="text-sm font-medium text-rose-900">เหตุผลที่ขอลบข่าว</h2><p className="mt-1 break-words whitespace-pre-wrap text-sm text-rose-800">{deleteReason}</p></section> : null}
      {request.reviewNote ? <div className="rounded-lg border border-gray-200 bg-white p-3"><p className="text-sm text-gray-700">หมายเหตุจากผู้พิจารณา: {request.reviewNote}</p></div> : null}
    </article>
  </div>;
}
