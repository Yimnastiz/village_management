import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SuperAdminNewsForm } from "../../superadmin-news-form";

export default async function SuperAdminEditNewsPage({ params }: { params: Promise<{ villageId: string; newsId: string }> }) {
  const { villageId, newsId } = await params;
  const news = await prisma.news.findFirst({ where: { id: newsId, villageId } });
  if (!news) notFound();
  const images = (Array.isArray(news.imageUrls) ? news.imageUrls.map(String).filter(Boolean) : []).map((url, sortOrder) => ({ url, sortOrder, isCover: news.coverUrl ? url === news.coverUrl : sortOrder === 0 }));
  return <div className="mx-auto w-full max-w-3xl space-y-6 px-1 sm:px-0"><div className="flex items-center gap-3"><Link href={`/superadmin/villages/${villageId}/news/${newsId}`} className="text-gray-400 hover:text-gray-600"><ArrowLeft className="h-5 w-5" /></Link><h1 className="text-2xl font-bold text-gray-900">แก้ไขข่าว</h1></div><SuperAdminNewsForm villageId={villageId} mode="edit" newsId={newsId} stage={news.stage} defaultValues={{ title: news.title, summary: news.summary ?? "", content: news.content, images, visibility: news.visibility, isPinned: news.isPinned }} /></div>;
}
