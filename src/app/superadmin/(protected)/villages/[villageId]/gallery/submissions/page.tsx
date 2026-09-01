import Link from "next/link";
import { ImagePlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { RequestViewTabs } from "@/components/ui/request-view-tabs";
import { prisma } from "@/lib/prisma";
import { formatThaiDateTime } from "@/lib/utils";

const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" };
const statusLabel: Record<string, string> = { PENDING: "รอพิจารณา", APPROVED: "อนุมัติแล้ว", REJECTED: "ไม่อนุมัติ" };
type Query = { albumId?: string; batchId?: string; tab?: string };

export default async function GallerySubmissions({ params, searchParams }: { params: Promise<{ villageId: string }>; searchParams?: Promise<Query> }) {
  const { villageId } = await params;
  const query = (searchParams ? await searchParams : {}) ?? {};
  const tab = query.tab === "history" ? "history" : "pending";
  const scope = { album: { villageId }, ...(query.albumId ? { albumId: query.albumId } : {}), ...(query.batchId ? { batchId: query.batchId } : {}) };
  const [pendingCount, submissions, batchCounts] = await Promise.all([
    prisma.galleryItemSubmission.count({ where: { ...scope, status: "PENDING" } }),
    prisma.galleryItemSubmission.findMany({ where: tab === "pending" ? { ...scope, status: "PENDING" } : { ...scope, status: { in: ["APPROVED", "REJECTED"] } }, orderBy: [{ batchId: "desc" }, { batchOrder: "asc" }, { createdAt: "desc" }], include: { album: { select: { id: true, title: true } }, requester: { select: { name: true, phoneNumber: true } } } }),
    prisma.galleryItemSubmission.groupBy({ by: ["batchId"], where: { album: { villageId }, batchId: { not: null } }, _count: { _all: true } }),
  ]);
  const batchTotals = new Map(batchCounts.flatMap((batch) => batch.batchId ? [[batch.batchId, batch._count._all] as const] : []));
  const base = `/superadmin/villages/${villageId}/gallery`;
  const href = (next: "pending" | "history") => { const params = new URLSearchParams({ ...(query.albumId ? { albumId: query.albumId } : {}), ...(query.batchId ? { batchId: query.batchId } : {}), ...(next === "history" ? { tab: "history" } : {}) }); return `${base}/submissions${params.size ? `?${params}` : ""}`; };
  const requestTabs = <RequestViewTabs label="สถานะคำขอรูปภาพ" tabs={[{ href: href("pending"), label: "รอพิจารณา", active: tab === "pending", count: pendingCount }, { href: href("history"), label: "ประวัติ", active: tab === "history" }]} />;
  return <div className="space-y-3"><AdminPageToolbar sticky variant="request" backHref={base} backLabel="กลับรายการแกลเลอรี" backPlacement="header-end" title="คำขอเพิ่มรูปภาพ" description="ตรวจสอบและพิจารณารูปภาพที่ลูกบ้านส่งมา" secondaryActions={requestTabs} />{submissions.length === 0 ? <EmptyState icon={ImagePlus} title={tab === "pending" ? "ไม่มีคำขอที่รอพิจารณา" : "ยังไม่มีประวัติคำขอ"} description="คำขอรูปภาพจะแสดงที่นี่" /> : <div className="space-y-2">{submissions.map((submission) => { const batchTotal = submission.batchId ? batchTotals.get(submission.batchId) ?? 1 : 1; return <article key={submission.id} className="rounded-xl border border-gray-200 bg-white p-3"><div className="flex min-w-0 flex-col gap-3 sm:flex-row"><Link href={`${base}/submissions/${submission.id}`} className="h-28 w-full shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:w-36"><img src={submission.fileUrl} alt={submission.title || "รูปภาพคำขอ"} loading="lazy" className="h-full w-full object-cover" /></Link><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge variant={statusVariant[submission.status] ?? "default"}>{statusLabel[submission.status] ?? submission.status}</Badge><Badge variant="outline">{submission.album.title}</Badge></div><Link href={`${base}/submissions/${submission.id}`} className="mt-2 block break-words font-medium text-gray-900 hover:underline">{submission.title || "ไม่มีคำอธิบายรูปภาพ"}</Link><p className="mt-1 break-words text-sm text-gray-500">ผู้ส่ง: {submission.requester.name} · {submission.requester.phoneNumber}</p>{submission.batchId ? <p className="mt-1 text-xs text-gray-500">ส่งพร้อมกัน {batchTotal} รูป · รูปที่ {(submission.batchOrder ?? 0) + 1} จาก {batchTotal}</p> : null}{submission.note ? <p className="mt-1 line-clamp-1 text-sm text-gray-600">{submission.note}</p> : null}<p className="mt-1 text-xs text-gray-400">ส่งเมื่อ {formatThaiDateTime(submission.createdAt)}</p>{tab === "history" && submission.reviewNote ? <p className="mt-1 line-clamp-1 text-xs text-rose-700">เหตุผล: {submission.reviewNote}</p> : null}</div></div></article>; })}</div>}</div>;
}
