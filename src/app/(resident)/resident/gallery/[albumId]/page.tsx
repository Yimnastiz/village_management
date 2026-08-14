import Link from "next/link";
import { ArrowLeft, ImagePlus } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SaveButton } from "@/components/ui/save-button";
import { AlbumGalleryViewer } from "@/components/gallery/album-gallery-viewer";
import { getResidentVillageAccess, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { formatThaiDate, formatThaiDateTime } from "@/lib/utils";
import { toggleSaveAlbumAction } from "@/features/saved/server/actions";

type ResidentAlbumDetailPageProps = { params: Promise<{ albumId: string }>; };
type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";
const statusLabel: Record<SubmissionStatus, string> = { PENDING: "รอพิจารณา", APPROVED: "อนุมัติแล้ว", REJECTED: "ไม่อนุมัติ" };

export default async function ResidentAlbumDetailPage({ params }: ResidentAlbumDetailPageProps) {
  const { albumId } = await params;
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  const membership = await getResidentVillageAccess(session);
  if (!membership) redirect("/resident/dashboard");
  const album = await prisma.galleryAlbum.findFirst({ where: { id: albumId, villageId: membership.villageId, ...(!membership.hasResidentAccess ? { isPublic: true } : {}) }, include: { items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], select: { id: true, title: true, fileUrl: true, isCover: true } } } });
  if (!album) notFound();
  const [saved, recentSubmissions] = await Promise.all([
    prisma.savedItem.findFirst({ where: { userId: session.id, galleryAlbumId: album.id }, select: { id: true } }),
    membership.hasResidentAccess ? prisma.galleryItemSubmission.findMany({ where: { albumId: album.id, requesterId: session.id }, orderBy: [{ createdAt: "desc" }], take: 50, select: { id: true, batchId: true, batchOrder: true, status: true, fileUrl: true, reviewNote: true, createdAt: true } }) : Promise.resolve([]),
  ]);
  const submissionGroups = Array.from(recentSubmissions.reduce((groups, submission) => { const key = submission.batchId ?? `legacy-${submission.id}`; const current = groups.get(key) ?? []; current.push(submission); groups.set(key, current); return groups; }, new Map<string, typeof recentSubmissions>()).values()).sort((a, b) => b[0].createdAt.getTime() - a[0].createdAt.getTime()).slice(0, 5);

  return <div className="space-y-4 sm:space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><Link href="/resident/gallery" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" />กลับหน้าแกลเลอรี</Link><div className="flex flex-wrap items-center gap-2">{membership.hasResidentAccess ? <SaveButton itemId={album.id} initialSaved={Boolean(saved)} toggleAction={toggleSaveAlbumAction} label="บันทึก" /> : null}{membership.hasResidentAccess && album.allowResidentSubmissions ? <Link href={`/resident/gallery/${album.id}/request`}><Button size="sm"><ImagePlus className="mr-1 h-4 w-4" />ขอเพิ่มรูป</Button></Link> : null}</div></div><article className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"><div className="flex flex-wrap items-center gap-2"><Badge variant={album.isPublic ? "success" : "info"}>{album.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}</Badge>{album.allowResidentSubmissions ? <Badge variant="warning">ส่งรูปเพิ่มได้</Badge> : null}</div><h1 className="text-2xl font-bold text-gray-900">{album.title}</h1><p className="text-sm text-gray-500">วันที่อัลบั้ม {formatThaiDate(album.albumDate)}</p>{album.description ? <p className="text-sm text-gray-600">{album.description}</p> : null}<AlbumGalleryViewer items={album.items} /></article>{membership.hasResidentAccess ? <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold text-gray-900">คำขอเพิ่มรูปของฉัน</h2><Badge variant="outline">{submissionGroups.length} รายการล่าสุด</Badge></div>{submissionGroups.length === 0 ? <p className="text-sm text-gray-500">ยังไม่มีคำขอในอัลบั้มนี้</p> : <div className="space-y-3">{submissionGroups.map((group) => { const counts = group.reduce<Record<SubmissionStatus, number>>((value, submission) => ({ ...value, [submission.status]: value[submission.status] + 1 }), { PENDING: 0, APPROVED: 0, REJECTED: 0 }); const notes = group.filter((submission) => submission.reviewNote).sort((a, b) => (a.batchOrder ?? 0) - (b.batchOrder ?? 0)); return <article key={group[0].batchId ?? group[0].id} className="rounded-lg border border-gray-200 p-3"><div className="flex gap-3"><img src={group[0].fileUrl} alt="รูปที่ส่ง" className="h-14 w-14 shrink-0 rounded-lg object-cover" /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-gray-900">{formatThaiDateTime(group[0].createdAt)}</p><p className="mt-1 text-sm text-gray-600">ส่ง {group.length} รูป</p><div className="mt-2 flex flex-wrap gap-2 text-xs">{(["PENDING", "APPROVED", "REJECTED"] as const).filter((status) => counts[status]).map((status) => <span key={status} className={status === "APPROVED" ? "text-emerald-700" : status === "REJECTED" ? "text-rose-700" : "text-amber-700"}>{statusLabel[status]} {counts[status]}</span>)}</div></div></div>{notes.map((submission) => <p key={submission.id} className="mt-2 text-sm text-gray-600">{submission.status === "REJECTED" ? "เหตุผลที่ไม่อนุมัติ" : "หมายเหตุจากผู้พิจารณา"}: {submission.reviewNote}</p>)}</article>; })}</div>}</section> : null}</div>;
}
