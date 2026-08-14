import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GalleryRequestImageViewer } from "@/components/gallery/gallery-request-image-viewer";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { formatThaiDateTime } from "@/lib/utils";

export default async function ResidentGalleryRequestDetailPage({ params, searchParams }: { params: Promise<{ batchId: string }>; searchParams?: Promise<{ image?: string }> }) {
  const { batchId } = await params;
  const highlightedId = (await searchParams)?.image;
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  const membership = getResidentMembership(session);
  if (!membership) redirect("/resident/dashboard");
  const seed = await prisma.galleryItemSubmission.findFirst({ where: { requesterId: session.id, album: { villageId: membership.villageId }, OR: [{ batchId }, { id: batchId }] }, select: { id: true, batchId: true } });
  if (!seed) notFound();
  const submissions = await prisma.galleryItemSubmission.findMany({ where: { requesterId: session.id, album: { villageId: membership.villageId }, ...(seed.batchId ? { batchId: seed.batchId } : { id: seed.id }) }, select: { id: true, batchId: true, batchOrder: true, status: true, title: true, fileUrl: true, reviewNote: true, createdAt: true, album: { select: { id: true, title: true } } }, orderBy: [{ batchOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }] });
  const first = submissions[0];
  return <div className="mx-auto w-full max-w-5xl space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><Link href="/resident/gallery/requests" className="inline-flex items-center gap-1.5 px-1 py-2 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" />กลับคำขอเพิ่มรูปของฉัน</Link><Link href={`/resident/gallery/${first.album.id}`}><Button size="sm" variant="outline">ดูอัลบั้ม</Button></Link></div><header><h1 className="text-2xl font-bold text-gray-900">คำขอเพิ่มรูปภาพ</h1><p className="mt-1 text-sm text-gray-600">อัลบั้ม: {first.album.title}</p><p className="mt-1 text-sm text-gray-500">ส่งเมื่อ {formatThaiDateTime(first.createdAt)}</p></header><GalleryRequestImageViewer albumTitle={first.album.title} highlightedId={highlightedId} images={submissions.map((submission) => ({ id: submission.id, url: submission.fileUrl, title: submission.title, status: submission.status, reviewNote: submission.reviewNote }))} /></div>;
}
