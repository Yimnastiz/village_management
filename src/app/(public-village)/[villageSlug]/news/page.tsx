import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Newspaper } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { NEWS_AUTHOR_SOURCE_LABELS } from "@/lib/constants";
import { normalizeVillageSlugParam, getSlugVariants } from "@/lib/village-slug";
import { PublicNewsToolbar } from "./public-news-toolbar";

interface PageProps {
  params: Promise<{ villageSlug: string }>;
  searchParams?: Promise<{ q?: string; sort?: string }>;
}

export default async function VillageNewsPage({ params, searchParams }: PageProps) {
  const { villageSlug: rawVillageSlug } = await params;
  const villageSlug = normalizeVillageSlugParam(rawVillageSlug);
  const query = (searchParams ? await searchParams : {}) ?? {};
  const keyword = query.q?.trim() ?? "";
  const sort = query.sort === "oldest" ? "oldest" : "newest";
  const adminRoles = ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] as const;

  const village = await prisma.village.findFirst({
    where: { slug: { in: getSlugVariants(villageSlug) } },
    select: { id: true, name: true },
  });
  if (!village) notFound();

  const newsList = await prisma.news.findMany({
    where: {
      villageId: village.id,
      stage: "PUBLISHED",
      visibility: "PUBLIC",
      ...(keyword
        ? {
            title: {
              contains: keyword,
              mode: "insensitive" as const,
            },
          }
        : {}),
    },
    orderBy:
      sort === "oldest"
        ? [{ isPinned: "desc" }, { publishedAt: "asc" }, { createdAt: "asc" }]
        : [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      summary: true,
      publishedAt: true,
      createdAt: true,
      isPinned: true,
      authorId: true,
      author: {
        select: {
          memberships: {
            where: {
              villageId: village.id,
              status: "ACTIVE",
            },
            select: { role: true },
          },
        },
      },
    },
  });

  const titleSuggestions = await prisma.news.findMany({
    where: {
      villageId: village.id,
      stage: "PUBLISHED",
      visibility: "PUBLIC",
    },
    select: { title: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  const suggestionTitles = Array.from(new Set(titleSuggestions.map((item) => item.title))).slice(0, 20);

  return (
    <div className="space-y-6">
      <PublicNewsToolbar
        villageSlug={villageSlug}
        villageName={village.name}
        keyword={keyword}
        sort={sort}
        suggestionTitles={suggestionTitles}
      />

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
                    <Badge variant="outline">
                      {(() => {
                        if (!news.authorId) return NEWS_AUTHOR_SOURCE_LABELS.UNKNOWN;
                        const roles = news.author?.memberships.map((membershipItem) => membershipItem.role) ?? [];
                        const isAdminSource = roles.some((role) => adminRoles.includes(role as (typeof adminRoles)[number]));
                        return isAdminSource ? NEWS_AUTHOR_SOURCE_LABELS.ADMIN : NEWS_AUTHOR_SOURCE_LABELS.RESIDENT;
                      })()}
                    </Badge>
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
