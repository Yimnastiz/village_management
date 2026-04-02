import Link from "next/link";
import { ArrowLeft, Clock3, MapPin, Phone } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  VILLAGE_PLACE_CATEGORY_LABELS,
  VILLAGE_PLACE_SUBMISSION_STATUS_LABELS,
  VILLAGE_PLACE_SUBMISSION_TYPE_LABELS,
} from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, getHeadmanMembership, isAdminUser } from "@/lib/access-control";
import { parseVillagePlacePayload } from "@/lib/village-place";
import { getVillagePlaceEmbedMapUrl } from "@/lib/village-place";
import { PlaceRequestReviewButtons } from "../request-review-buttons";

type RequestDetail = {
  id: string;
  type: string;
  status: string;
  payload: unknown;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  requester: {
    name: string;
    phoneNumber: string;
  };
};

type VillagePlaceSubmissionDetailDelegate = {
  findFirst(args: unknown): Promise<RequestDetail | null>;
};

type PageProps = {
  params: Promise<{ requestId: string }>;
};

const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export default async function AdminPlaceRequestDetailPage({ params }: PageProps) {
  const { requestId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = getHeadmanMembership(session);
  if (!membership) redirect("/auth/login");

  const villagePlaceSubmission =
    (prisma as unknown as { villagePlaceSubmission: VillagePlaceSubmissionDetailDelegate }).villagePlaceSubmission;

  const request = await villagePlaceSubmission.findFirst({
    where: {
      id: requestId,
      villageId: membership.villageId,
    },
    include: {
      requester: { select: { name: true, phoneNumber: true } },
    },
  });

  if (!request) notFound();

  const payload = parseVillagePlacePayload(request.payload);
  if (!payload) notFound();
  const embedMapUrl = getVillagePlaceEmbedMapUrl(payload.latitude, payload.longitude);

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/admin/places/requests" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> กลับรายการคำขอ
      </Link>

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{VILLAGE_PLACE_SUBMISSION_TYPE_LABELS[request.type] ?? request.type}</Badge>
          <Badge variant={statusVariant[request.status] ?? "default"}>
            {VILLAGE_PLACE_SUBMISSION_STATUS_LABELS[request.status] ?? request.status}
          </Badge>
          <Badge variant="outline">{VILLAGE_PLACE_CATEGORY_LABELS[payload.category]}</Badge>
          <Badge variant={payload.isPublic ? "success" : "info"}>{payload.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}</Badge>
        </div>

        <p className="text-sm text-gray-600">
          ผู้ส่งคำขอ: {request.requester.name} ({request.requester.phoneNumber})
        </p>

        <h1 className="text-2xl font-bold text-gray-900">{payload.name}</h1>

        <div className="grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
          {payload.address && (
            <p className="inline-flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-gray-500" /> {payload.address}
            </p>
          )}
          {payload.openingHours && (
            <p className="inline-flex items-start gap-2">
              <Clock3 className="mt-0.5 h-4 w-4 text-gray-500" /> {payload.openingHours}
            </p>
          )}
          {payload.contactPhone && (
            <p className="inline-flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 text-gray-500" /> {payload.contactPhone}
            </p>
          )}
          {payload.latitude != null && payload.longitude != null && (
            <p className="text-xs text-gray-500">พิกัด: {payload.latitude}, {payload.longitude}</p>
          )}
        </div>

        {payload.description && (
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="whitespace-pre-wrap leading-7 text-gray-700">{payload.description}</p>
          </div>
        )}

        {payload.mapUrl && (
          <div>
            <a href={payload.mapUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-700 hover:text-blue-800">
              เปิดแผนที่
            </a>
          </div>
        )}

        {embedMapUrl && (
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <iframe
              title={`request-map-${request.id}`}
              src={embedMapUrl}
              className="h-72 w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}

        {Array.isArray(payload.imageUrls) && payload.imageUrls.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {payload.imageUrls.map((url) => (
              <img key={url} src={url} alt={payload.name} className="h-28 w-full rounded-lg object-cover" />
            ))}
          </div>
        )}

        {request.status === "PENDING" ? (
          <PlaceRequestReviewButtons requestId={request.id} />
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
