import Link from "next/link";
import { FileClock, ImageIcon } from "lucide-react";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { formatThaiDateTime } from "@/lib/date-format";
import { NEWS_SUBMISSION_STATUS_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getAdminMembership, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { parseNewsSubmissionPayload, newsSubmissionTypeLabel } from "@/lib/news-submission";
import { getPendingNewsSubmissionCount } from "@/lib/news-submission.server";
import { getVillageReviewerDisplayMap } from "@/lib/village-reviewer";

const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" };

export default async function AdminNewsRequestListPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");
  const membership = getAdminMembership(session);
  if (!membership) redirect("/auth/login");

  const tab = (await searchParams)?.tab === "history" ? "history" : "pending";
  const where: Prisma.NewsSubmissionWhereInput = { villageId: membership.villageId, ...(tab === "pending" ? { status: "PENDING" } : { status: { in: ["APPROVED", "REJECTED"] } }) };
  const [requests, pendingCount] = await Promise.all([
    prisma.newsSubmission.findMany({
      where,
      orderBy: tab === "history" ? [{ reviewedAt: "desc" }, { createdAt: "desc" }] : [{ createdAt: "desc" }],
      include: {
        requester: { select: { name: true, phoneNumber: true } },
        targetNews: { select: { title: true, coverUrl: true, imageUrls: true } },
      },
    }),
    getPendingNewsSubmissionCount(membership.villageId),
  ]);
  const payloads = new Map(requests.map((request) => [request.id, parseNewsSubmissionPayload(request.payload)]));
  const reviewerDisplayById = tab === "history" ? await getVillageReviewerDisplayMap(requests.flatMap((request) => request.reviewedBy ? [request.reviewedBy] : []), membership.villageId) : new Map();

  return <div data-admin-compact-top className="space-y-3"><AdminPageToolbar variant="request" backHref="/admin/news" backLabel="กลับรายการข่าว" backPlacement="header-end" title="คำขอข่าวจากลูกบ้าน" description="ตรวจสอบคำขอเพิ่ม แก้ไข หรือลบข่าวจากลูกบ้าน" secondaryActions={<div className="flex gap-1 border-b border-gray-200"><Link href="/admin/news/requests" className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === "pending" ? "border-green-700 text-green-800" : "border-transparent text-gray-500 hover:text-gray-700"}`}>รอพิจารณา ({pendingCount})</Link><Link href="/admin/news/requests?tab=history" className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === "history" ? "border-green-700 text-green-800" : "border-transparent text-gray-500 hover:text-gray-700"}`}>ประวัติ</Link></div>} />{requests.length === 0 ? <div className="rounded-xl border border-gray-200 bg-white p-10 text-center"><FileClock className="mx-auto mb-3 h-10 w-10 text-gray-300" /><p className="font-medium text-gray-700">{tab === "pending" ? "ไม่มีคำขอข่าวที่รอพิจารณา" : "ยังไม่มีประวัติคำขอข่าว"}</p></div> : <div className="space-y-2">{requests.map((request) => { const payload = payloads.get(request.id) ?? null; const targetImageUrls = Array.isArray(request.targetNews?.imageUrls) ? request.targetNews.imageUrls.map((url) => String(url)).filter(Boolean) : []; const previewUrl = payload?.coverUrl ?? request.targetNews?.coverUrl ?? targetImageUrls[0]; const title = payload?.title || request.targetNews?.title || "ข้อมูลคำขอไม่ถูกต้อง"; const reviewer = request.reviewedBy ? reviewerDisplayById.get(request.reviewedBy) : null; return <Link key={request.id} href={`/admin/news/requests/${request.id}`} className="block rounded-xl border border-gray-200 bg-white p-3 transition hover:border-gray-300 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"><div className="flex gap-3"><div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 sm:h-20 sm:w-20">{previewUrl ? <img src={previewUrl} alt={`ภาพตัวอย่าง ${title}`} loading="lazy" className="h-full w-full object-cover" /> : <ImageIcon aria-hidden className="h-5 w-5 text-gray-400" />}</div><div className="min-w-0 flex-1"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="outline">{newsSubmissionTypeLabel(request.type, payload)}</Badge><Badge variant={statusVariant[request.status] ?? "default"}>{NEWS_SUBMISSION_STATUS_LABELS[request.status] ?? request.status}</Badge></div><p className="truncate font-medium text-gray-900">{title}</p>{request.targetNews?.title ? <p className="mt-1 truncate text-xs text-gray-500">อ้างอิงข่าว: {request.targetNews.title}</p> : null}<p className="mt-1 text-sm text-gray-500">ผู้ส่ง: {request.requester.name} · {request.requester.phoneNumber}</p></div><p className="text-xs text-gray-400 sm:max-w-44 sm:text-right">ส่งเมื่อ {formatThaiDateTime(request.createdAt)}</p></div>{tab === "history" ? <div className="mt-2 text-xs text-gray-500"><p className="flex flex-col gap-0.5 sm:block"><span>พิจารณาโดย {reviewer?.label ?? "ผู้ดูแลหมู่บ้าน"}</span>{request.reviewedAt ? <><span className="hidden sm:inline"> · </span><span>พิจารณาเมื่อ {formatThaiDateTime(request.reviewedAt)}</span></> : null}</p>{request.status === "REJECTED" && request.reviewNote ? <p className="mt-1 line-clamp-1 text-rose-700">เหตุผล: {request.reviewNote}</p> : null}</div> : null}</div></div></Link>; })}</div>}</div>;
}
