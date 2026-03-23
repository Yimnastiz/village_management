import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { Newspaper } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { normalizeVillageSlugParam } from "@/lib/village-slug";

interface PageProps {
  params: Promise<{ villageSlug: string }>;
}

export default async function VillageNewsPage({ params }: PageProps) {
  const { villageSlug: rawVillageSlug } = await params;
  const villageSlug = normalizeVillageSlugParam(rawVillageSlug);

  const village = await prisma.village.findUnique({
    where: { slug: villageSlug },
    select: { id: true, name: true },
  });
  if (!village) notFound();

  const newsList = await prisma.news.findMany({
    where: {
      villageId: village.id,
      stage: "PUBLISHED",
      visibility: "PUBLIC",
    },
    orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      summary: true,
      publishedAt: true,
      createdAt: true,
      isPinned: true,
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">ข่าวสารหมู่บ้าน {village.name}</h1>

      {newsList.length === 0 ? (
        <EmptyState icon={Newspaper} title="ยังไม่มีข่าวสาธารณะ" description="ข่าวสาธารณะของหมู่บ้านจะแสดงที่นี่" />
      ) : (
        <div className="space-y-3">
          {newsList.map((news) => (
            <Link
              key={news.id}
              href={`/${villageSlug}/news/${news.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {news.isPinned && (
                      <span className="text-[11px] rounded-full bg-yellow-100 text-yellow-700 px-2 py-0.5">
                        ปักหมุด
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-gray-900 line-clamp-1">{news.title}</p>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{news.summary || "-"}</p>
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap">
                  {(news.publishedAt ?? news.createdAt).toLocaleDateString("th-TH")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
