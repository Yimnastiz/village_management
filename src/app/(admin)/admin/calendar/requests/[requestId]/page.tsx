import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  VILLAGE_EVENT_SUBMISSION_STATUS_LABELS,
  VILLAGE_EVENT_VISIBILITY_LABELS,
} from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, getHeadmanMembership, isAdminUser } from "@/lib/access-control";
import { CalendarRequestReviewButtons } from "../request-review-buttons";

type RequestDetail = {
  id: string;
  status: string;
  isPublic: boolean;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  requester: {
    name: string;
    phoneNumber: string;
  };
};

type VillageEventSubmissionDetailDelegate = {
  findFirst(args: unknown): Promise<RequestDetail | null>;
};

type AdminCalendarRequestDetailPageProps = {
  params: Promise<{ requestId: string }>;
};

const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export default async function AdminCalendarRequestDetailPage({ params }: AdminCalendarRequestDetailPageProps) {
  const { requestId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = getHeadmanMembership(session);
  if (!membership) redirect("/auth/login");

  const villageEventSubmission = (
    prisma as unknown as { villageEventSubmission: VillageEventSubmissionDetailDelegate }
  ).villageEventSubmission;

  const request = await villageEventSubmission.findFirst({
    where: {
      id: requestId,
      villageId: membership.villageId,
    },
    include: {
      requester: { select: { name: true, phoneNumber: true } },
    },
  });

  if (!request) notFound();

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href="/admin/calendar/requests"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> กลับรายการคำขอ
      </Link>

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant[request.status] ?? "default"}>
            {VILLAGE_EVENT_SUBMISSION_STATUS_LABELS[request.status] ?? request.status}
          </Badge>
          <Badge variant="outline">
            {VILLAGE_EVENT_VISIBILITY_LABELS[request.isPublic ? "PUBLIC" : "RESIDENT"]}
          </Badge>
        </div>

        <p className="text-sm text-gray-600">
          ผู้ส่งคำขอ: {request.requester.name} ({request.requester.phoneNumber})
        </p>

        <h1 className="text-2xl font-bold text-gray-900">{request.title}</h1>

        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          <div>
            <p className="text-gray-500">สถานที่</p>
            <p className="mt-1 text-gray-900">{request.location || "ไม่ระบุ"}</p>
          </div>
          <div>
            <p className="text-gray-500">วันเวลาเริ่ม</p>
            <p className="mt-1 text-gray-900">{new Date(request.startsAt).toLocaleString("th-TH")}</p>
          </div>
          <div>
            <p className="text-gray-500">วันเวลาสิ้นสุด</p>
            <p className="mt-1 text-gray-900">{request.endsAt ? new Date(request.endsAt).toLocaleString("th-TH") : "ไม่ระบุ"}</p>
          </div>
        </div>

        {request.description && (
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="whitespace-pre-wrap leading-7 text-gray-700">{request.description}</p>
          </div>
        )}

        {request.status === "PENDING" ? (
          <CalendarRequestReviewButtons requestId={request.id} />
        ) : (
          <div className="text-sm text-gray-600">
            <p>
              ผู้พิจารณา: {request.reviewedBy || "-"} • {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString("th-TH") : "-"}
            </p>
            {request.reviewNote && <p className="mt-1">หมายเหตุ: {request.reviewNote}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
