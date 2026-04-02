import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NEWS_STAGE_LABELS, NEWS_VISIBILITY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { ImageCarousel } from "@/components/ui/image-carousel";
import { NewsDeleteButton } from "./news-delete-button";

interface PageProps {
  params: Promise<{ newsId: string }>;
}

const stageVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  DRAFT: "warning",
  PUBLISHED: "success",
  ARCHIVED: "default",
};

export default async function AdminNewsDetailPage({ params }: PageProps) {
  const { newsId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const news = await prisma.news.findFirst({
    where: { id: newsId, villageId: membership.villageId },
    include: {
      author: {
        select: { name: true },
      },
    },
  });
  if (!news) notFound();

  const imageUrls = Array.isArray(news.imageUrls)
    ? news.imageUrls.map((value) => String(value)).filter((url) => url.length > 0)
    : [];

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/news" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> กลับรายการข่าว
        </Link>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Link href={`/admin/news/${newsId}/edit`}>
            <Button size="sm" variant="outline">
              <Pencil className="h-4 w-4 mr-1" /> แก้ไข
            </Button>
          </Link>
          <NewsDeleteButton newsId={newsId} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {news.isPinned && (
            <span className="text-xs rounded-full bg-yellow-100 text-yellow-700 px-2 py-1">ปักหมุด</span>
          )}
          <Badge variant={stageVariant[news.stage] ?? "default"}>{NEWS_STAGE_LABELS[news.stage]}</Badge>
          <Badge variant="outline">{NEWS_VISIBILITY_LABELS[news.visibility]}</Badge>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">{news.title}</h1>
        <p className="text-sm text-gray-400 mt-2">
          {news.publishedAt
            ? `เผยแพร่เมื่อ ${news.publishedAt.toLocaleDateString("th-TH")}`
            : `สร้างเมื่อ ${news.createdAt.toLocaleDateString("th-TH")}`}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          ผู้สร้างข่าว: {news.author?.name || (news.authorId ? "ผู้ใช้ที่ไม่พบข้อมูล" : "ไม่ระบุ")}
        </p>

        {news.summary && <p className="mt-4 text-gray-600">{news.summary}</p>}

        {imageUrls.length > 0 && (
          <div className="mt-6">
            <ImageCarousel images={imageUrls} altPrefix={news.title} />
          </div>
        )}

        <div className="mt-6 border-t pt-6">
          <p className="whitespace-pre-wrap text-gray-700 leading-7">{news.content}</p>
        </div>
      </div>
    </div>
  );
}
