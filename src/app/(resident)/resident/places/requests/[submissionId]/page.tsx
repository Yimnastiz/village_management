import Link from "next/link";
import { ArrowLeft, Clock3, MapPin, Phone } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageCarousel } from "@/components/ui/image-carousel";
import { MEMBERSHIP_ROLE_LABELS, VILLAGE_PLACE_CATEGORY_LABELS, VILLAGE_PLACE_SUBMISSION_STATUS_LABELS, VILLAGE_PLACE_SUBMISSION_TYPE_LABELS } from "@/lib/constants";
import { formatThaiDateTime } from "@/lib/date-format";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { getVillagePlaceEmbedMapUrl, parseVillagePlacePayload } from "@/lib/village-place";
import { materializePlaceImages } from "@/lib/place-image.server";

const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" };

export default async function ResidentPlaceRequestDetailPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  const membership = getResidentMembership(session);
  if (!membership) redirect("/resident/dashboard");

  const request = await prisma.villagePlaceSubmission.findFirst({ where: { id: submissionId, requesterId: session.id, villageId: membership.villageId }, select: { id: true, type: true, status: true, targetPlaceId: true, approvedPlaceId: true, payload: true, reviewedBy: true, reviewedAt: true, reviewNote: true, createdAt: true } });
  if (!request) notFound();
  const payload = parseVillagePlacePayload(request.payload);
  if (!payload) notFound();
  const [imageRows, reviewer] = await Promise.all([
    materializePlaceImages(prisma, payload.images, membership.villageId, { existingPlaceId: request.targetPlaceId ?? undefined, trustedNew: true }),
    request.reviewedBy ? prisma.user.findUnique({ where: { id: request.reviewedBy }, select: { id: true, name: true, memberships: { where: { villageId: membership.villageId, status: "ACTIVE" }, select: { role: true, status: true }, take: 1 } } }) : null,
  ]);
  const images = (imageRows ?? []).map((image) => image.url);
  const mapUrl = getVillagePlaceEmbedMapUrl(payload.latitude, payload.longitude);
  const isUpdate = request.type === "UPDATE";
  const reviewerRole = reviewer?.memberships[0]?.role;
  const reviewerName = reviewer?.name?.trim() || "ผู้ดูแลหมู่บ้าน";
  const reviewerLabel = reviewerRole && reviewerRole !== "RESIDENT" ? `${reviewerName} (${MEMBERSHIP_ROLE_LABELS[reviewerRole] ?? reviewerRole})` : reviewerName;

  return <div className="mx-auto w-full max-w-3xl space-y-3 sm:space-y-4"><Link href="/resident/places/requests" className="inline-flex items-center gap-1.5 px-1 py-2 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" />กลับรายการคำขอ</Link><article className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"><header><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{VILLAGE_PLACE_SUBMISSION_TYPE_LABELS[request.type] ?? request.type}</Badge><Badge variant={statusVariant[request.status] ?? "default"}>{VILLAGE_PLACE_SUBMISSION_STATUS_LABELS[request.status] ?? request.status}</Badge><Badge variant="outline">{VILLAGE_PLACE_CATEGORY_LABELS[payload.category]}</Badge></div><h1 className="mt-3 text-2xl font-bold text-gray-900">คำขอ{isUpdate ? "แก้ไขสถานที่" : "เพิ่มสถานที่"}</h1><p className="mt-1 text-sm text-gray-500">ส่งเมื่อ {formatThaiDateTime(request.createdAt)}</p></header>{request.status === "PENDING" && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">กำลังรอผู้ดูแลหมู่บ้านตรวจสอบ</p>}{request.status === "APPROVED" && <div className="rounded-lg bg-green-50 px-3 py-3 text-sm text-green-900"><p>{isUpdate ? "สถานที่ถูกอัปเดตเรียบร้อยแล้ว" : "สถานที่ถูกเพิ่มเข้ารายการเรียบร้อยแล้ว"}</p>{request.approvedPlaceId && <Link href={`/resident/places/${request.approvedPlaceId}`} className="mt-2 inline-flex"><Button size="sm" variant="outline">ดูสถานที่</Button></Link>}</div>}{request.status === "REJECTED" && <div className="rounded-lg bg-rose-50 px-3 py-3 text-sm text-rose-900"><p className="font-medium">ไม่อนุมัติคำขอนี้</p><p className="mt-1 whitespace-pre-wrap">เหตุผล: {request.reviewNote ?? "-"}</p><Link href={isUpdate && request.targetPlaceId ? `/resident/places/${request.targetPlaceId}/request-edit` : "/resident/places/requests/new"} className="mt-3 inline-flex"><Button size="sm" variant="outline">ส่งคำขอใหม่</Button></Link></div>}<section className="space-y-3"><h2 className="font-semibold text-gray-900">ข้อมูลที่ส่ง</h2><p className="text-lg font-medium text-gray-900">{payload.name}</p>{images.length > 0 && <ImageCarousel images={images} altPrefix={payload.name} />}<div className="grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">{payload.address && <p className="inline-flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4" />{payload.address}</p>}{payload.openingHours && <p className="inline-flex items-start gap-2"><Clock3 className="mt-0.5 h-4 w-4" />{payload.openingHours}</p>}{payload.contactPhone && <p className="inline-flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4" />{payload.contactPhone}</p>}</div>{payload.description && <p className="whitespace-pre-wrap leading-7 text-gray-700">{payload.description}</p>}{payload.mapUrl && <a href={payload.mapUrl} target="_blank" rel="noreferrer" className="inline-flex text-sm font-medium text-green-700 hover:text-green-800">เปิดแผนที่</a>}{mapUrl && <iframe title={`request-map-${request.id}`} src={mapUrl} className="h-64 w-full rounded-xl border border-gray-200" loading="lazy" />}</section>{request.status !== "PENDING" && <section className="grid gap-3 border-t border-gray-100 pt-3 text-sm sm:grid-cols-2"><div><p className="text-gray-500">ผู้พิจารณา</p><p className="mt-1 font-medium text-gray-800">{reviewerLabel}</p></div><div><p className="text-gray-500">พิจารณาเมื่อ</p><p className="mt-1 font-medium text-gray-800">{request.reviewedAt ? formatThaiDateTime(request.reviewedAt) : "-"}</p></div></section>}</article></div>;
}
