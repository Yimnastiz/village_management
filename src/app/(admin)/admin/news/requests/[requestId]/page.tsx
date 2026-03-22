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
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { ImageCarousel } from "@/components/ui/image-carousel";
import { RequestReviewButtons } from "../request-review-buttons";

interface PageProps {
  params: Promise<{ requestId: string }>;
}

export default async function AdminNewsRequestDetailPage({ params }: PageProps) {
  const { requestId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const request = await prisma.newsSubmission.findFirst({
    where: { id: requestId, villageId: membership.villageId },
    include: {
      requester: { select: { name: true } },
      targetNews: { select: { id: true, title: true } },
    },
  });
  if (!request) notFound();

  const payload = request.payload as Prisma.JsonObject;
  const imageUrls = Array.isArray(payload.imageUrls)
    ? payload.imageUrls.map((value) => String(value)).filter((url) => url.length > 0)
    : [];

  const stage = String(payload.stage ?? "DRAFT");
  const visibility = String(payload.visibility ?? "PUBLIC");

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href="/admin/news/requests"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> กลับรายการคำขอ
      </Link>

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{NEWS_SUBMISSION_TYPE_LABELS[request.type]}</Badge>
          <Badge variant={request.status === "PENDING" ? "warning" : request.status === "APPROVED" ? "success" : "danger"}>
            {NEWS_SUBMISSION_STATUS_LABELS[request.status]}
          </Badge>
        </div>

        <p className="text-sm text-gray-600">ผู้ส่งคำขอ: {request.requester.name}</p>
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

        {request.status === "PENDING" ? (
          <RequestReviewButtons requestId={request.id} />
        ) : (
          <div className="text-sm text-gray-600">
            <p>
              ผู้พิจารณา: {request.reviewedBy || "-"} • {request.reviewedAt ? request.reviewedAt.toLocaleString("th-TH") : "-"}
            </p>
            {request.reviewNote && <p className="mt-1">หมายเหตุ: {request.reviewNote}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
