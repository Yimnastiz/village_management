import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { ImageCarousel } from "@/components/ui/image-carousel";
import { prisma } from "@/lib/prisma";
import { normalizeVillageSlugParam, getSlugVariants } from "@/lib/village-slug";

interface PageProps {
  params: Promise<{ villageSlug: string; newsId: string }>;
}

export default async function VillageNewsDetailPage({ params }: PageProps) {
  const { villageSlug: rawVillageSlug, newsId } = await params;
  const villageSlug = normalizeVillageSlugParam(rawVillageSlug);

  const village = await prisma.village.findFirst({
    where: { slug: { in: getSlugVariants(villageSlug) } },
    select: { id: true, name: true, slug: true },
  });
  if (!village) notFound();

  const news = await prisma.news.findFirst({
    where: {
      id: newsId,
      villageId: village.id,
      stage: "PUBLISHED",
      visibility: "PUBLIC",
    },
  });
  if (!news) notFound();

  const imageUrls = Array.isArray(news.imageUrls)
    ? news.imageUrls.map((value) => String(value)).filter((url) => url.length > 0)
    : [];

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href={`/${village.slug}/news`}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> กลับรายการข่าว
      </Link>

      <div className="rounded-xl border border-gray-200 bg-white p-8">
        <h1 className="text-2xl font-bold text-gray-900">{news.title}</h1>
        <p className="text-sm text-gray-400 mt-2">
          {(news.publishedAt ?? news.createdAt).toLocaleDateString("th-TH")}
        </p>
        {news.summary && <p className="text-sm text-gray-600 mt-3">{news.summary}</p>}

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
