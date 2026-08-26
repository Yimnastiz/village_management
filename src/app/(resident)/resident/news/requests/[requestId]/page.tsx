import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Prisma } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  NEWS_STAGE_LABELS,
  NEWS_SUBMISSION_STATUS_LABELS,
  NEWS_SUBMISSION_TYPE_LABELS,
  NEWS_VISIBILITY_LABELS,
} from "@/lib/constants";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { ImageCarousel } from "@/components/ui/image-carousel";
import { ResidentNewsRequestActions } from "./resident-news-request-actions";

interface PageProps {
  params: Promise<{ requestId: string }>;
}

export default async function ResidentNewsRequestDetailPage({ params }: PageProps) {
  const { requestId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  const membership = getResidentMembership(session);
  if (!membership) redirect("/resident/dashboard");

  const request = await prisma.newsSubmission.findFirst({
    where: {
      id: requestId,
      requesterId: session.id,
      villageId: membership.villageId,
    },
    include: {
      targetNews: {
        select: { id: true, title: true },
      },
    },
  });

  if (!request) notFound();

  const payload = request.payload as Prisma.JsonObject;
  const imageUrls = Array.isArray(payload.imageUrls)
    ? payload.imageUrls.map((value) => String(value)).filter((url) => url.length > 0)
    : [];

  const stage = String(payload.stage ?? "DRAFT");
  const visibility = String(payload.visibility ?? "PUBLIC");
  const isDeleteRequest = payload.isDeleteRequest === true;
  const isPending = request.status === "PENDING";
  const editable = isPending && !isDeleteRequest;
  const deletable = isPending && (request.type === "CREATE" || request.type === "UPDATE");

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href="/resident/news/requests"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> กลับรายการคำขอ
      </Link>

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{NEWS_SUBMISSION_TYPE_LABELS[request.type]}</Badge>
          <Badge variant={request.status === "PENDING" ? "warning" : request.status === "APPROVED" ? "success" : "danger"}>
            {NEWS_SUBMISSION_STATUS_LABELS[request.status]}
          </Badge>
        </div>

        {request.targetNews?.title && (
          <p className="text-sm text-gray-600">ข่าวปลายทาง: {request.targetNews.title}</p>
        )}

        <h1 className="text-2xl font-bold text-gray-900">{String(payload.title ?? "-")}</h1>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{NEWS_STAGE_LABELS[stage] || stage}</Badge>
          <Badge variant="outline">{NEWS_VISIBILITY_LABELS[visibility] || visibility}</Badge>
          {Boolean(payload.isPinned) && <Badge variant="warning">ขอปักหมุด</Badge>}
        </div>

        {String(payload.summary ?? "").trim().length > 0 && (
          <p className="text-sm text-gray-600">{String(payload.summary)}</p>
        )}

        {imageUrls.length > 0 && <ImageCarousel images={imageUrls} altPrefix={String(payload.title ?? "news")} />}

        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <p className="whitespace-pre-wrap text-gray-700 leading-7">{String(payload.content ?? "-")}</p>
        </div>

        {request.reviewNote && (
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-sm text-gray-700">หมายเหตุจากผู้พิจารณา: {request.reviewNote}</p>
          </div>
        )}

        <ResidentNewsRequestActions requestId={request.id} editable={editable} deletable={deletable} />
      </div>
    </div>
  );
}
