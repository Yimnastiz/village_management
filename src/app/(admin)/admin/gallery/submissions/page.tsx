import Link from "next/link";
import { ImagePlus } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { getAdminMembership, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { formatThaiDateTime } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { GallerySubmissionReviewButtons } from "./request-review-buttons";

const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" };
const statusLabel: Record<string, string> = { PENDING: "รอพิจารณา", APPROVED: "อนุมัติแล้ว", REJECTED: "ไม่อนุมัติ" };
type Query = { albumId?: string; batchId?: string; tab?: string };

export default async function AdminGallerySubmissionsPage({ searchParams }: { searchParams?: Promise<Query> }) {
  const params = (searchParams ? await searchParams : {}) ?? {};
  const tab = params.tab === "history" ? "history" : "pending";
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");
  const membership = getAdminMembership(session);
  if (!membership) redirect("/resident");
  const scope = { album: { villageId: membership.villageId }, ...(params.albumId ? { albumId: params.albumId } : {}), ...(params.batchId ? { batchId: params.batchId } : {}) };
  const [pendingCount, submissions, batchCounts] = await Promise.all([
    prisma.galleryItemSubmission.count({ where: { ...scope, status: "PENDING" } }),
    prisma.galleryItemSubmission.findMany({ where: tab === "pending" ? { ...scope, status: "PENDING" } : { ...scope, status: { in: ["APPROVED", "REJECTED"] } }, include: { album: { select: { id: true, title: true } }, requester: { select: { name: true, phoneNumber: true } } }, orderBy: [{ batchId: "desc" }, { batchOrder: "asc" }, { createdAt: "desc" }] }),
    prisma.galleryItemSubmission.groupBy({ by: ["batchId"], where: { album: { villageId: membership.villageId }, batchId: { not: null } }, _count: { _all: true } }),
  ]);
  const batchTotals = new Map(batchCounts.flatMap((batch) => batch.batchId ? [[batch.batchId, batch._count._all] as const] : []));
  const href = (next: "pending" | "history") => { const query = new URLSearchParams({ ...(params.albumId ? { albumId: params.albumId } : {}), ...(params.batchId ? { batchId: params.batchId } : {}), ...(next === "history" ? { tab: "history" } : {}) }); return `/admin/gallery/submissions?${query}`; };
  return <div data-admin-compact-top className="space-y-3"><AdminPageToolbar sticky variant="request" backHref="/admin/gallery" backLabel="กลับรายการแกลเลอรี" backPlacement="header-end" title="คำขอเพิ่มรูปภาพ" description="ตรวจสอบและพิจารณารูปภาพที่ลูกบ้านส่งมา" secondaryActions={<div className="flex gap-1 border-b border-gray-200"><Link href={href("pending")} className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === "pending" ? "border-green-700 text-green-800" : "border-transparent text-gray-500"}`}>รอพิจารณา ({pendingCount})</Link><Link href={href("history")} className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === "history" ? "border-green-700 text-green-800" : "border-transparent text-gray-500"}`}>ประวัติ</Link></div>} />{submissions.length === 0 ? <EmptyState icon={ImagePlus} title={tab === "pending" ? "ไม่มีคำขอที่รอพิจารณา" : "ยังไม่มีประวัติคำขอ"} description="คำขอรูปภาพจะแสดงที่นี่" /> : <div className="space-y-2">{submissions.map((submission) => { const batchTotal = submission.batchId ? batchTotals.get(submission.batchId) ?? 1 : 1; return <article key={submission.id} className="rounded-xl border border-gray-200 bg-white p-3"><div className="flex flex-col gap-3 sm:flex-row"><Link href={`/admin/gallery/submissions/${submission.id}`} className="h-28 w-full shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:w-36"><img src={submission.fileUrl} alt={submission.title || "รูปภาพคำขอ"} loading="lazy" className="h-full w-full object-cover" /></Link><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge variant={statusVariant[submission.status] ?? "default"}>{statusLabel[submission.status]}</Badge><Badge variant="outline">{submission.album.title}</Badge></div><Link href={`/admin/gallery/submissions/${submission.id}`} className="mt-2 block font-medium text-gray-900 hover:underline">{submission.title || "ไม่มีคำอธิบายรูปภาพ"}</Link><p className="mt-1 text-sm text-gray-500">ผู้ส่ง: {submission.requester.name} · {submission.requester.phoneNumber}</p>{submission.batchId ? <p className="mt-1 text-xs text-gray-500">ส่งพร้อมกัน {batchTotal} รูป · รูปที่ {(submission.batchOrder ?? 0) + 1} จาก {batchTotal}</p> : null}{submission.note ? <p className="mt-1 line-clamp-1 text-sm text-gray-600">{submission.note}</p> : null}<p className="mt-1 text-xs text-gray-400">ส่งเมื่อ {formatThaiDateTime(submission.createdAt)}</p>{tab === "history" && submission.reviewNote ? <p className="mt-1 line-clamp-1 text-xs text-rose-700">เหตุผล: {submission.reviewNote}</p> : null}</div>{tab === "pending" ? <div className="shrink-0"><GallerySubmissionReviewButtons submissionId={submission.id} compact /></div> : null}</div></article>; })}</div>}</div>;
}
