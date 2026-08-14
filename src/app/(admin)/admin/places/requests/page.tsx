import Link from "next/link";
import { ArrowLeft, FileClock, ImageIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { formatThaiDateTime } from "@/lib/date-format";
import { VILLAGE_PLACE_CATEGORY_LABELS, VILLAGE_PLACE_SUBMISSION_STATUS_LABELS, VILLAGE_PLACE_SUBMISSION_TYPE_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getAdminMembership, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { selectPlaceCoverImage } from "@/lib/place-image";
import { parseVillagePlacePayload } from "@/lib/village-place";
import { getVillageReviewerDisplayMap } from "@/lib/village-reviewer";

type RequestItem = { id: string; type: string; status: string; payload: unknown; createdAt: Date; reviewedBy: string | null; reviewedAt: Date | null; reviewNote: string | null; requester: { name: string; phoneNumber: string } };
type VillagePlaceSubmissionListDelegate = { findMany(args: unknown): Promise<RequestItem[]>; count(args: unknown): Promise<number> };
const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" };

export default async function AdminPlaceRequestListPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const session = await getSessionContextFromServerCookies(); if (!session?.id) redirect("/auth/login"); if (!isAdminUser(session)) redirect("/resident");
  const membership = getAdminMembership(session); if (!membership) redirect("/auth/login");
  const tab = (await searchParams)?.tab === "history" ? "history" : "pending";
  const villagePlaceSubmission = (prisma as unknown as { villagePlaceSubmission: VillagePlaceSubmissionListDelegate }).villagePlaceSubmission;
  const where = { villageId: membership.villageId, ...(tab === "pending" ? { status: "PENDING" } : { status: { in: ["APPROVED", "REJECTED"] } }) };
  const [requests, pendingCount] = await Promise.all([villagePlaceSubmission.findMany({ where, orderBy: [{ createdAt: "desc" }], include: { requester: { select: { name: true, phoneNumber: true } } } }), villagePlaceSubmission.count({ where: { villageId: membership.villageId, status: "PENDING" } })]);
  const payloads = new Map(requests.map((request) => [request.id, parseVillagePlacePayload(request.payload)]));
  const reviewerDisplayById = tab === "history"
    ? await getVillageReviewerDisplayMap(requests.flatMap((request) => request.reviewedBy ? [request.reviewedBy] : []), membership.villageId)
    : new Map();
  const coverImageIds = requests.flatMap((request) => {
    const cover = selectPlaceCoverImage(payloads.get(request.id)?.images);
    return cover?.id ? [cover.id] : [];
  });
  // Existing-image references in update submissions are resolved in one village-scoped read.
  const coverUrlsById = new Map((coverImageIds.length ? await prisma.villagePlaceImage.findMany({ where: { id: { in: coverImageIds }, place: { villageId: membership.villageId } }, select: { id: true, url: true } }) : []).map((image) => [image.id, image.url]));

  return <div className="space-y-4"><Link href="/admin/places" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" /> กลับรายการสถานที่</Link><div><h1 className="text-2xl font-bold text-gray-900">คำขอสถานที่จากลูกบ้าน</h1><p className="mt-1 text-sm text-gray-500">ตรวจสอบคำขอเพิ่มหรือแก้ไขสถานที่จากลูกบ้าน</p></div><div className="flex gap-2 border-b border-gray-200"><Link href="/admin/places/requests" className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === "pending" ? "border-green-700 text-green-800" : "border-transparent text-gray-500 hover:text-gray-700"}`}>รอพิจารณา ({pendingCount})</Link><Link href="/admin/places/requests?tab=history" className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === "history" ? "border-green-700 text-green-800" : "border-transparent text-gray-500 hover:text-gray-700"}`}>ประวัติ</Link></div>{requests.length === 0 ? <div className="rounded-xl border border-gray-200 bg-white p-10 text-center"><FileClock className="mx-auto mb-3 h-10 w-10 text-gray-300" /><p className="font-medium text-gray-700">{tab === "pending" ? "ไม่มีคำขอที่รอพิจารณา" : "ยังไม่มีประวัติคำขอสถานที่"}</p></div> : <div className="space-y-2">{requests.map((request) => { const payload = payloads.get(request.id); const cover = selectPlaceCoverImage(payload?.images); const coverUrl = cover?.url ?? (cover?.id ? coverUrlsById.get(cover.id) : undefined); const reviewer = request.reviewedBy ? reviewerDisplayById.get(request.reviewedBy) : null; return <Link key={request.id} href={`/admin/places/requests/${request.id}`} className="block rounded-xl border border-gray-200 bg-white p-3 transition hover:border-gray-300 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"><div className="flex gap-3"><div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 sm:h-20 sm:w-20">{coverUrl ? <img src={coverUrl} alt={`หน้าปก ${payload?.name ?? "คำขอสถานที่"}`} loading="lazy" className="h-full w-full object-cover" /> : <ImageIcon aria-hidden className="h-5 w-5 text-gray-400" />}</div><div className="min-w-0 flex-1"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="outline">{VILLAGE_PLACE_SUBMISSION_TYPE_LABELS[request.type] ?? request.type}</Badge><Badge variant={statusVariant[request.status] ?? "default"}>{VILLAGE_PLACE_SUBMISSION_STATUS_LABELS[request.status] ?? request.status}</Badge><Badge variant="outline">{VILLAGE_PLACE_CATEGORY_LABELS[payload?.category ?? "OTHER"]}</Badge></div><p className="truncate font-medium text-gray-900">{payload?.name ?? "ข้อมูลคำขอไม่ถูกต้อง"}</p><p className="mt-1 text-sm text-gray-500">ผู้ส่ง: {request.requester.name} • {request.requester.phoneNumber}</p></div><p className="text-xs text-gray-400 sm:max-w-44 sm:text-right">ส่งเมื่อ {formatThaiDateTime(request.createdAt)}</p></div>{tab === "history" && <div className="mt-2 text-xs text-gray-500"><p className="flex flex-col gap-0.5 sm:block"><span>พิจารณาโดย {reviewer?.label ?? "ผู้ดูแลหมู่บ้าน"}</span>{request.reviewedAt ? <><span className="hidden sm:inline"> · </span><span>พิจารณาเมื่อ {formatThaiDateTime(request.reviewedAt)}</span></> : null}</p>{request.reviewNote && <p className="mt-1 line-clamp-1 text-rose-700">เหตุผล: {request.reviewNote}</p>}</div>}</div></div></Link>; })}</div>}</div>;
}
