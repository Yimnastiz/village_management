import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { NEWS_VISIBILITY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { ImageCarousel } from "@/components/ui/image-carousel";
import { NewsSaveButton } from "./news-save-button";

interface PageProps {
  params: Promise<{ newsId: string }>;
}

export default async function ResidentNewsDetailPage({ params }: PageProps) {
  const { newsId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/auth/login");

  const [news, savedItem] = await Promise.all([
    prisma.news.findFirst({
      where: {
        id: newsId,
        villageId: membership.villageId,
        stage: "PUBLISHED",
        visibility: { in: ["PUBLIC", "RESIDENT_ONLY"] },
      },
    }),
    prisma.savedItem.findFirst({
      where: { userId: session.id, newsId },
      select: { id: true },
    }),
  ]);

  if (!news) notFound();

  const imageUrls = Array.isArray(news.imageUrls)
    ? news.imageUrls.map((value) => String(value)).filter((url) => url.length > 0)
    : [];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/resident/news"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" /> กลับรายการข่าว
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/resident/news/${newsId}/request-edit`} className="text-sm text-green-700 hover:text-green-800">
            ขอแก้ไขข่าวนี้
          </Link>
          <NewsSaveButton newsId={newsId} initialSaved={Boolean(savedItem)} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            {news.isPinned && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">ปักหมุด</span>
            )}
            <Badge variant="outline">{NEWS_VISIBILITY_LABELS[news.visibility]}</Badge>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-3">{news.title}</h1>
          <p className="text-sm text-gray-400 mt-2">
            {(news.publishedAt ?? news.createdAt).toLocaleDateString("th-TH")}
          </p>
          {news.summary && <p className="text-sm text-gray-600 mt-3">{news.summary}</p>}
        </div>

        {imageUrls.length > 0 && (
          <div className="mb-6">
            <ImageCarousel images={imageUrls} altPrefix={news.title} />
          </div>
        )}

        <div className="border-t pt-6">
          <p className="whitespace-pre-wrap text-gray-700 leading-7">{news.content}</p>
        </div>
      </div>
    </div>
  );
}
