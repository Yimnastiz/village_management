import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageCarousel } from "@/components/ui/image-carousel";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { formatThaiDateTime } from "@/lib/utils";

const statusVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" };
const statusLabel: Record<string, string> = { PENDING: "รอพิจารณา", APPROVED: "อนุมัติแล้ว", REJECTED: "ไม่อนุมัติ" };

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
  const images = submissions.map((submission) => submission.fileUrl);
  return <div className="mx-auto w-full max-w-5xl space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><Link href="/resident/gallery/requests" className="inline-flex items-center gap-1.5 px-1 py-2 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" />กลับคำขอเพิ่มรูปของฉัน</Link><Link href={`/resident/gallery/${first.album.id}`}><Button size="sm" variant="outline">ดูอัลบั้ม</Button></Link></div><header><h1 className="text-2xl font-bold text-gray-900">คำขอเพิ่มรูปภาพ</h1><p className="mt-1 text-sm text-gray-600">อัลบั้ม: {first.album.title}</p><p className="mt-1 text-sm text-gray-500">ส่งเมื่อ {formatThaiDateTime(first.createdAt)}</p></header><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{submissions.map((submission, index) => <article id={submission.id} key={submission.id} className={`scroll-mt-24 overflow-hidden rounded-xl border bg-white ${highlightedId === submission.id ? "border-green-500 ring-2 ring-green-100" : "border-gray-200"}`}><ImageCarousel images={images} altPrefix={`คำขอเพิ่มรูป ${first.album.title}`} initialIndex={index} compact /><div className="space-y-3 p-4"><div className="flex items-center justify-between gap-2"><p className="font-medium text-gray-900">รูปที่ {index + 1}</p><Badge variant={statusVariant[submission.status] ?? "default"}>{statusLabel[submission.status]}</Badge></div>{submission.title ? <p className="text-sm text-gray-600">{submission.title}</p> : null}{submission.status === "REJECTED" ? <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900"><p className="font-medium">เหตุผลที่ไม่อนุมัติ</p><p className="mt-1 whitespace-pre-wrap">{submission.reviewNote || "-"}</p></div> : null}{submission.status === "APPROVED" && submission.reviewNote ? <div className="rounded-lg bg-green-50 p-3 text-sm text-green-900"><p className="font-medium">หมายเหตุจากผู้พิจารณา</p><p className="mt-1 whitespace-pre-wrap">{submission.reviewNote}</p></div> : null}</div></article>)}</div></div>;
}
