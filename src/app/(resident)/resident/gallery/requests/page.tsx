import Link from "next/link";
import { ArrowLeft, FileClock } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ResidentPageToolbar } from "@/components/resident/resident-page-toolbar";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { formatThaiDateTime } from "@/lib/utils";

type Tab = "pending" | "history";
type Status = "PENDING" | "APPROVED" | "REJECTED";
type Submission = { id: string; batchId: string | null; batchOrder: number | null; status: Status; fileUrl: string; createdAt: Date; album: { id: string; title: string } };
type Batch = { key: string; submissions: Submission[] };

function statusSummary(submissions: Submission[]) {
  const counts = submissions.reduce<Record<Status, number>>((result, submission) => ({ ...result, [submission.status]: result[submission.status] + 1 }), { PENDING: 0, APPROVED: 0, REJECTED: 0 });
  if (counts.APPROVED === submissions.length) return "อนุมัติทั้งหมด";
  if (counts.REJECTED === submissions.length) return "ไม่อนุมัติทั้งหมด";
  return ([counts.PENDING ? `รอพิจารณา ${counts.PENDING}` : null, counts.APPROVED ? `อนุมัติแล้ว ${counts.APPROVED}` : null, counts.REJECTED ? `ไม่อนุมัติ ${counts.REJECTED}` : null].filter(Boolean)).join(" · ");
}

export default async function ResidentGalleryRequestsPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  const membership = getResidentMembership(session);
  if (!membership) redirect("/resident/dashboard");
  const tab: Tab = (await searchParams)?.tab === "history" ? "history" : "pending";
  const submissions = await prisma.galleryItemSubmission.findMany({ where: { requesterId: session.id, album: { villageId: membership.villageId } }, select: { id: true, batchId: true, batchOrder: true, status: true, fileUrl: true, createdAt: true, album: { select: { id: true, title: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 200 });
  const batches = Array.from(submissions.reduce((groups, submission) => { const key = submission.batchId ?? `legacy-${submission.id}`; const batch = groups.get(key) ?? { key, submissions: [] }; batch.submissions.push(submission); groups.set(key, batch); return groups; }, new Map<string, Batch>()).values()).map((batch) => ({ ...batch, submissions: [...batch.submissions].sort((a, b) => (a.batchOrder ?? 0) - (b.batchOrder ?? 0) || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)) })).filter((batch) => tab === "pending" ? batch.submissions.some((submission) => submission.status === "PENDING") : batch.submissions.every((submission) => submission.status !== "PENDING"));
  const pendingCount = Array.from(submissions.reduce((groups, submission) => { const key = submission.batchId ?? `legacy-${submission.id}`; const current = groups.get(key) ?? []; current.push(submission); groups.set(key, current); return groups; }, new Map<string, typeof submissions>()).values()).filter((batch) => batch.some((submission) => submission.status === "PENDING")).length;
  const href = (next: Tab) => next === "history" ? "/resident/gallery/requests?tab=history" : "/resident/gallery/requests";
  return <div className="space-y-4"><ResidentPageToolbar namespace="resident-gallery-requests" title="คำขอเพิ่มรูปของฉัน" description="ติดตามสถานะรูปภาพที่ส่งให้ผู้ดูแลพิจารณา" actions={<Link href="/resident/gallery" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"><ArrowLeft className="h-4 w-4" />กลับหน้าแกลเลอรี</Link>} /><div className="flex gap-1 border-b border-gray-200"><Link href={href("pending")} className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === "pending" ? "border-green-700 text-green-800" : "border-transparent text-gray-500"}`}>รอพิจารณา ({pendingCount})</Link><Link href={href("history")} className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === "history" ? "border-green-700 text-green-800" : "border-transparent text-gray-500"}`}>ประวัติ</Link></div>{batches.length === 0 ? <EmptyState icon={FileClock} title={tab === "pending" ? "ไม่มีคำขอที่รอพิจารณา" : "ยังไม่มีประวัติคำขอเพิ่มรูป"} /> : <div className="space-y-3">{batches.map((batch) => { const first = batch.submissions[0]; const visibleThumbnails = batch.submissions.slice(0, 4); const routeId = first.batchId ?? first.id; return <Link key={batch.key} href={`/resident/gallery/requests/${routeId}`} className="block rounded-xl border border-gray-200 bg-white p-3 transition hover:border-gray-300 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="flex shrink-0 -space-x-2 overflow-hidden py-1">{visibleThumbnails.map((submission) => <img key={submission.id} src={submission.fileUrl} alt="รูปที่ส่ง" className="h-14 w-14 rounded-lg border-2 border-white object-cover sm:h-16 sm:w-16" />)}{batch.submissions.length > visibleThumbnails.length ? <span className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-white bg-gray-100 text-xs font-medium text-gray-700 sm:h-16 sm:w-16">+{batch.submissions.length - visibleThumbnails.length}</span> : null}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{first.album.title}</Badge></div><p className="mt-2 text-sm text-gray-500">{formatThaiDateTime(first.createdAt)}</p><p className="mt-1 text-sm text-gray-700">ส่ง {batch.submissions.length} รูป</p><p className="mt-1 text-sm font-medium text-gray-800">{statusSummary(batch.submissions)}</p></div></div></Link>; })}</div>}</div>;
}
