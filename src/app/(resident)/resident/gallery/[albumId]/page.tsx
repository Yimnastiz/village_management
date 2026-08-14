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

type Status = "PENDING" | "APPROVED" | "REJECTED";
const summaryText = (submissions: Array<{ status: Status }>) => {
  const counts = submissions.reduce<Record<Status, number>>((result, submission) => ({ ...result, [submission.status]: result[submission.status] + 1 }), { PENDING: 0, APPROVED: 0, REJECTED: 0 });
  if (counts.APPROVED === submissions.length) return "อนุมัติทั้งหมด";
  if (counts.REJECTED === submissions.length) return "ไม่อนุมัติทั้งหมด";
  return [counts.PENDING ? `รอพิจารณา ${counts.PENDING}` : null, counts.APPROVED ? `อนุมัติแล้ว ${counts.APPROVED}` : null, counts.REJECTED ? `ไม่อนุมัติ ${counts.REJECTED}` : null].filter(Boolean).join(" · ");
};

export default async function ResidentAlbumDetailPage({ params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params;
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  const membership = await getResidentVillageAccess(session);
  if (!membership) redirect("/resident/dashboard");
  const album = await prisma.galleryAlbum.findFirst({ where: { id: albumId, villageId: membership.villageId, ...(!membership.hasResidentAccess ? { isPublic: true } : {}) }, include: { items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], select: { id: true, title: true, fileUrl: true, isCover: true } } } });
  if (!album) notFound();
  const [saved, recentSubmissions] = await Promise.all([prisma.savedItem.findFirst({ where: { userId: session.id, galleryAlbumId: album.id }, select: { id: true } }), membership.hasResidentAccess ? prisma.galleryItemSubmission.findMany({ where: { albumId: album.id, requesterId: session.id }, orderBy: [{ createdAt: "desc" }], take: 50, select: { id: true, batchId: true, batchOrder: true, status: true, fileUrl: true, createdAt: true } }) : Promise.resolve([])]);
  const batches = Array.from(recentSubmissions.reduce((groups, submission) => { const key = submission.batchId ?? `legacy-${submission.id}`; const current = groups.get(key) ?? []; current.push(submission); groups.set(key, current); return groups; }, new Map<string, typeof recentSubmissions>()).values()).map((batch) => [...batch].sort((a, b) => (a.batchOrder ?? 0) - (b.batchOrder ?? 0) || a.createdAt.getTime() - b.createdAt.getTime())).sort((a, b) => b[0].createdAt.getTime() - a[0].createdAt.getTime()).slice(0, 5);
  return <div className="space-y-4 sm:space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><Link href="/resident/gallery" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" />กลับหน้าแกลเลอรี</Link><div className="flex flex-wrap items-center gap-2">{membership.hasResidentAccess ? <SaveButton itemId={album.id} initialSaved={Boolean(saved)} toggleAction={toggleSaveAlbumAction} label="บันทึก" /> : null}{membership.hasResidentAccess && album.allowResidentSubmissions ? <Link href={`/resident/gallery/${album.id}/request`}><Button size="sm"><ImagePlus className="mr-1 h-4 w-4" />ขอเพิ่มรูป</Button></Link> : null}</div></div><article className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"><div className="flex flex-wrap items-center gap-2"><Badge variant={album.isPublic ? "success" : "info"}>{album.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}</Badge>{album.allowResidentSubmissions ? <Badge variant="warning">ส่งรูปเพิ่มได้</Badge> : null}</div><h1 className="text-2xl font-bold text-gray-900">{album.title}</h1><p className="text-sm text-gray-500">วันที่อัลบั้ม {formatThaiDate(album.albumDate)}</p>{album.description ? <p className="text-sm text-gray-600">{album.description}</p> : null}<AlbumGalleryViewer items={album.items} /></article>{membership.hasResidentAccess ? <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold text-gray-900">คำขอเพิ่มรูปล่าสุด</h2><Link href="/resident/gallery/requests" className="text-sm font-medium text-green-700 hover:text-green-800">ดูคำขอทั้งหมด</Link></div>{batches.length === 0 ? <p className="text-sm text-gray-500">ยังไม่มีคำขอในอัลบั้มนี้</p> : <div className="space-y-3">{batches.map((batch) => { const first = batch[0]; return <article key={first.batchId ?? first.id} className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center"><img src={first.fileUrl} alt="รูปที่ส่ง" className="h-14 w-14 shrink-0 rounded-lg object-cover" /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-gray-900">{formatThaiDateTime(first.createdAt)}</p><p className="mt-1 text-sm text-gray-600">ส่ง {batch.length} รูป</p><p className="mt-1 text-sm text-gray-700">{summaryText(batch)}</p></div><Link href={`/resident/gallery/requests/${first.batchId ?? first.id}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">ดูรายละเอียด</Link></article>; })}</div>}</section> : null}</div>;
}
