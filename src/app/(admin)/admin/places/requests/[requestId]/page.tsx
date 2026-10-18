import { Clock3, Globe2, MapPin, Phone, Users } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { Badge } from "@/components/ui/badge";
import { ImageCarousel } from "@/components/ui/image-carousel";
import { formatThaiDateTime } from "@/lib/date-format";
import { VILLAGE_PLACE_CATEGORY_LABELS, VILLAGE_PLACE_SUBMISSION_STATUS_LABELS, VILLAGE_PLACE_SUBMISSION_TYPE_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getVillagePermissionContext } from "@/lib/admin-permission.server";
import { getVillagePlaceEmbedMapUrl, parseVillagePlacePayload } from "@/lib/village-place";
import { getVillageReviewerDisplay } from "@/lib/village-reviewer";
import { PlaceRequestReviewButtons } from "../request-review-buttons";
import { RESIDENT_ACTOR_USER_SELECT, residentActorDisplay, type ResidentActorUser } from "@/lib/resident-actor-display";
import { DeletePlaceButton } from "../../delete-place-button";

type RequestDetail = { id: string; type: string; status: string; targetPlaceId: string | null; approvedPlaceId: string | null; payload: unknown; createdAt: Date; reviewedBy: string | null; reviewedAt: Date | null; reviewNote: string | null; requester: ResidentActorUser };
type VillagePlaceSubmissionDetailDelegate = { findFirst(args: unknown): Promise<RequestDetail | null> };
type PageProps = { params: Promise<{ requestId: string }> };
const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" };

export default async function AdminPlaceRequestDetailPage({ params }: PageProps) {
  const { requestId } = await params;
  const context = await getVillagePermissionContext("places.requests.review");
  if (!context) redirect("/admin/places");
  const membership = context.membership;
  const villagePlaceSubmission = (prisma as unknown as { villagePlaceSubmission: VillagePlaceSubmissionDetailDelegate }).villagePlaceSubmission;
  const requestRow = await villagePlaceSubmission.findFirst({ where: { id: requestId, villageId: membership.villageId }, include: { requester: { select: RESIDENT_ACTOR_USER_SELECT } } });
  if (!requestRow) notFound();
  const requesterDisplay = residentActorDisplay(requestRow.requester, { villageId: membership.villageId });
  const request = { ...requestRow, requester: { name: requesterDisplay.label, phoneNumber: requesterDisplay.contactPhone ?? "-" } };
  const payload = parseVillagePlacePayload(request.payload);
  if (!payload) notFound();
  const referencedImageIds = payload.images.flatMap((image) => image.id ? [image.id] : []);
  const [imageRows, reviewer, targetPlace, approvedPlace] = await Promise.all([
    referencedImageIds.length ? prisma.villagePlaceImage.findMany({ where: { id: { in: referencedImageIds }, place: { villageId: membership.villageId } }, select: { id: true, url: true } }) : [],
    getVillageReviewerDisplay(request.reviewedBy, membership.villageId),
    request.targetPlaceId ? prisma.villagePlace.findFirst({ where: { id: request.targetPlaceId, villageId: membership.villageId }, select: { id: true, isPublic: true, isFeatured: true } }) : null,
    request.approvedPlaceId ? prisma.villagePlace.findFirst({ where: { id: request.approvedPlaceId, villageId: membership.villageId }, select: { id: true } }) : null,
  ]);
  const imageUrlsById = new Map(imageRows.map((image) => [image.id, image.url]));
  const images = [...payload.images].sort((a, b) => a.sortOrder - b.sortOrder).flatMap((image) => {
    const url = image.url ?? (image.id ? imageUrlsById.get(image.id) : undefined);
    return url ? [{ url, isCover: image.isCover }] : [];
  });
  const coverIndex = images.findIndex((image) => image.isCover);
  const embedMapUrl = getVillagePlaceEmbedMapUrl(payload.latitude, payload.longitude);

  return (
    <div data-admin-compact-top className="space-y-3">
      <AdminPageToolbar
        variant="request"
        sticky
        backHref="/admin/places/requests"
        backLabel="กลับรายการคำขอ"
        backPlacement="header-start"
        title={payload.name}
        description="ตรวจสอบรายละเอียดคำขอสถานที่จากสมาชิก"
      />

      <div className="mx-auto w-full max-w-4xl">
        <article className="space-y-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{VILLAGE_PLACE_SUBMISSION_TYPE_LABELS[request.type] ?? request.type}</Badge>
              <Badge variant={statusVariant[request.status] ?? "default"}>{VILLAGE_PLACE_SUBMISSION_STATUS_LABELS[request.status] ?? request.status}</Badge>
              <Badge variant="outline">{VILLAGE_PLACE_CATEGORY_LABELS[payload.category]}</Badge>
              <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                {payload.isPublic ? <Globe2 className="h-4 w-4" aria-hidden="true" /> : <Users className="h-4 w-4" aria-hidden="true" />}
                {payload.isPublic ? "สาธารณะ" : "เฉพาะสมาชิก"}
              </span>
            </div>
            <dl className="grid gap-4 border-b border-gray-100 pb-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-gray-500">ผู้ส่งคำขอ</dt>
                <dd className="mt-1 font-medium text-gray-800">{request.requester.name} · {request.requester.phoneNumber}</dd>
              </div>
              <div>
                <dt className="text-gray-500">ส่งเมื่อ</dt>
                <dd className="mt-1 font-medium text-gray-800">{formatThaiDateTime(request.createdAt)}</dd>
              </div>
            </dl>
          </header>

          {images.length > 0 ? (
            <section className="space-y-2">
              <p className="text-sm text-gray-500">รูปภาพ {images.length} รูป</p>
              <ImageCarousel images={images.map((image) => image.url)} altPrefix={payload.name} coverIndex={coverIndex >= 0 ? coverIndex : undefined} thumbnailBehavior="select" />
            </section>
          ) : null}

          <section className="grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
            {payload.address ? <p className="inline-flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-gray-500" aria-hidden="true" />{payload.address}</p> : null}
            {payload.openingHours ? <p className="inline-flex items-start gap-2"><Clock3 className="mt-0.5 h-4 w-4 text-gray-500" aria-hidden="true" />{payload.openingHours}</p> : null}
            {payload.contactPhone ? <p className="inline-flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 text-gray-500" aria-hidden="true" />{payload.contactPhone}</p> : null}
            {payload.latitude != null && payload.longitude != null ? <p className="text-xs text-gray-500">พิกัด: {payload.latitude}, {payload.longitude}</p> : null}
          </section>

          {payload.description ? (
            <section className="border-t border-gray-100 pt-5">
              <h2 className="mb-2 font-medium text-gray-900">รายละเอียด</h2>
              <p className="whitespace-pre-wrap leading-7 text-gray-700">{payload.description}</p>
            </section>
          ) : null}
          {request.type === "DELETE" && payload.requestReason ? <section className="border-t border-gray-100 pt-5"><h2 className="text-sm font-medium text-gray-900">เหตุผลที่ขอลบ</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{payload.requestReason}</p></section> : null}

          {payload.mapUrl ? <a href={payload.mapUrl} target="_blank" rel="noreferrer" className="inline-flex text-sm font-medium text-blue-700 hover:text-blue-800">เปิดแผนที่</a> : null}
          {embedMapUrl ? <div className="overflow-hidden rounded-xl border border-gray-200"><iframe title={`request-map-${request.id}`} src={embedMapUrl} className="h-72 w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div> : null}

          <section className="border-t border-gray-100 pt-5">
            {request.status === "PENDING" ? (
              <PlaceRequestReviewButtons requestId={request.id} placeName={payload.name} type={request.type as "CREATE" | "UPDATE" | "DELETE"} proposedIsPublic={payload.isPublic} initialIsPublic={request.type === "UPDATE" ? targetPlace?.isPublic ?? payload.isPublic : payload.isPublic} initialIsFeatured={request.type === "UPDATE" ? targetPlace?.isFeatured ?? false : false} />
            ) : (
              <dl className="grid gap-4 text-sm text-gray-600 sm:grid-cols-2">
                <div>
                  <dt className="text-gray-500">ผู้พิจารณา</dt>
                  <dd className="mt-1 font-medium text-gray-800">{reviewer?.label ?? "ผู้ดูแลหมู่บ้าน"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">พิจารณาเมื่อ</dt>
                  <dd className="mt-1 font-medium text-gray-800">{request.reviewedAt ? formatThaiDateTime(request.reviewedAt) : "-"}</dd>
                </div>
                {request.reviewNote ? <div className="sm:col-span-2"><dt className="text-gray-500">{request.status === "REJECTED" ? "เหตุผลที่ไม่อนุมัติ" : "หมายเหตุ"}</dt><dd className="mt-1 whitespace-pre-wrap text-gray-800">{request.reviewNote}</dd></div> : null}
              </dl>
            )}
            {request.status === "APPROVED" && request.type === "CREATE" && approvedPlace ? <div className="mt-5 border-t border-gray-100 pt-5"><DeletePlaceButton placeId={approvedPlace.id} placeName={payload.name} /></div> : null}
          </section>
        </article>
      </div>
    </div>
  );
}
