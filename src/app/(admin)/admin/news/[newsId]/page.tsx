import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { ImageCarousel } from "@/components/ui/image-carousel";
import { NewsDeleteButton } from "./news-delete-button";
import { NewsLifecycleActions } from "./news-lifecycle-actions";
import { formatNewsAuthor } from "@/lib/news-author";
import { NewsMetadata } from "@/components/news/news-metadata";

export default async function AdminNewsDetailPage({ params }: { params: Promise<{ newsId: string }> }) {
  const { newsId } = await params; const session = await getSessionContextFromServerCookies(); if (!session?.id) redirect("/auth/login"); if (!isAdminUser(session)) redirect("/resident");
  const membership = await prisma.villageMembership.findFirst({ where: { userId: session.id, status: "ACTIVE" }, select: { villageId: true } }); if (!membership) redirect("/auth/login");
  const news = await prisma.news.findFirst({ where: { id: newsId, villageId: membership.villageId }, include: { author: { select: { name: true, systemRole: true, memberships: { where: { villageId: membership.villageId, status: "ACTIVE" }, select: { role: true } } } } } }); if (!news) notFound();
  const imageUrls = Array.isArray(news.imageUrls) ? news.imageUrls.map((value) => String(value)).filter(Boolean) : []; if (news.coverUrl && imageUrls.includes(news.coverUrl)) imageUrls.splice(0, 0, ...imageUrls.splice(imageUrls.indexOf(news.coverUrl), 1));
  return <div className="mx-auto w-full max-w-4xl space-y-6 px-1 sm:px-0"><div className="flex flex-wrap items-center justify-between gap-3"><Link href="/admin/news" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" />กลับรายการข่าว</Link><div className="flex w-full flex-wrap items-center gap-2 sm:w-auto"><Link href={`/admin/news/${newsId}/edit`}><Button size="sm" variant="outline"><Pencil className="mr-1 h-4 w-4" />แก้ไข</Button></Link><NewsLifecycleActions newsId={news.id} stage={news.stage} /><NewsDeleteButton newsId={newsId} /></div></div><article className="rounded-xl border border-gray-200 bg-white p-4 sm:p-8"><NewsMetadata className="mb-4 text-sm" stage={news.stage} visibility={news.visibility} isPinned={news.isPinned} /><h1 className="break-words text-2xl font-bold text-gray-900">{news.title}</h1><p className="mt-2 text-sm text-gray-400">{news.publishedAt ? `เผยแพร่เมื่อ ${news.publishedAt.toLocaleDateString("th-TH")}` : `สร้างเมื่อ ${news.createdAt.toLocaleDateString("th-TH")}`}</p><p className="mt-1 text-sm text-gray-500">ผู้สร้างข่าว: {formatNewsAuthor(news.author?.name, news.author?.systemRole, news.author?.memberships[0]?.role)}</p>{news.summary ? <p className="mt-4 text-gray-600">{news.summary}</p> : null}{imageUrls.length ? <div className="mt-6"><ImageCarousel images={imageUrls} altPrefix={news.title} thumbnailBehavior="select" /></div> : null}<div className="mt-6 border-t pt-6"><p className="whitespace-pre-wrap break-words leading-7 text-gray-700">{news.content}</p></div></article></div>;
}
