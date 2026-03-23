import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { GallerySubmissionReviewButtons } from "../request-review-buttons";

const db = prisma as any;

type AdminGallerySubmissionDetailPageProps = {
  params: Promise<{ submissionId: string }>;
};

const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

const statusLabel: Record<string, string> = {
  PENDING: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
};

export default async function AdminGallerySubmissionDetailPage({ params }: AdminGallerySubmissionDetailPageProps) {
  const { submissionId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const submission = await db.galleryItemSubmission.findFirst({
    where: {
      id: submissionId,
      album: { villageId: membership.villageId },
    },
    include: {
      album: { select: { id: true, title: true } },
      requester: { select: { id: true, name: true, phoneNumber: true } },
    },
  });

  if (!submission) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/admin/gallery/submissions"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> กลับรายการคำขอ
      </Link>

      <article className="space-y-5 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant[submission.status] ?? "default"}>{statusLabel[submission.status]}</Badge>
          <Badge variant="outline">{submission.album.title}</Badge>
        </div>

        <h1 className="text-xl font-bold text-gray-900">{submission.title || "(ไม่มีหัวข้อรูปภาพ)"}</h1>

        <div className="text-sm text-gray-600 space-y-1">
          <p>ผู้ส่งคำขอ: {submission.requester.name} ({submission.requester.phoneNumber})</p>
          <p>วันที่ส่ง: {submission.createdAt.toLocaleString("th-TH")}</p>
          {submission.reviewedAt && <p>วันที่รีวิว: {submission.reviewedAt.toLocaleString("th-TH")}</p>}
        </div>

        <div className="rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
          <img src={submission.fileUrl} alt={submission.title || "submission image"} className="w-full max-h-[420px] object-contain" />
        </div>

        {submission.note && (
          <div>
            <p className="text-sm font-medium text-gray-900">หมายเหตุจากผู้ส่ง</p>
            <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{submission.note}</p>
          </div>
        )}

        {submission.reviewNote && (
          <div>
            <p className="text-sm font-medium text-gray-900">หมายเหตุการรีวิว</p>
            <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{submission.reviewNote}</p>
          </div>
        )}

        {submission.status === "PENDING" ? (
          <GallerySubmissionReviewButtons submissionId={submission.id} />
        ) : (
          <p className="text-sm text-gray-500">คำขอนี้ถูกดำเนินการแล้ว</p>
        )}
      </article>
    </div>
  );
}
