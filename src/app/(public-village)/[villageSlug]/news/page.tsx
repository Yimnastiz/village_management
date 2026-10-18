import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Newspaper } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { NEWS_AUTHOR_SOURCE_LABELS } from "@/lib/constants";
import { normalizeVillageSlugParam, getSlugVariants } from "@/lib/village-slug";
import { PublicNewsToolbar } from "./public-news-toolbar";
import { NewsCard } from "@/components/news/news-card";
import { getNewsImageCount } from "@/lib/news-image-count";
import type { Prisma } from "@prisma/client";

interface PageProps {
  params: Promise<{ villageSlug: string }>;
  searchParams?: Promise<{ q?: string; sort?: string; source?: string }>;
}

type NewsSource = "all" | "headman" | "resident";

const SOURCE_EMPTY_STATE: Record<NewsSource, { title: string; description: string }> = {
  all: {
    title: "ยังไม่มีข่าวสาธารณะ",
    description: "ข่าวสาธารณะของหมู่บ้านจะแสดงที่นี่",
  },
  headman: {
    title: "ยังไม่มีข่าวจากผู้ใหญ่บ้าน",
    description: "เมื่อผู้ใหญ่บ้านเผยแพร่ข่าวสาธารณะ ข่าวจะแสดงที่นี่",
  },
  resident: {
    title: "ยังไม่มีข่าวจากสมาชิก",
    description: "เมื่อมีข่าวสาธารณะจากสมาชิก ข่าวจะแสดงที่นี่",
  },
};

export default async function VillageNewsPage({ params, searchParams }: PageProps) {
  const { villageSlug: rawVillageSlug } = await params;
  const villageSlug = normalizeVillageSlugParam(rawVillageSlug);
  const query = (searchParams ? await searchParams : {}) ?? {};
  const keyword = query.q?.trim() ?? "";
  const sort = query.sort === "oldest" ? "oldest" : "newest";
  const source: NewsSource = query.source === "headman" || query.source === "resident" ? query.source : "all";

  const village = await prisma.village.findFirst({
    where: { slug: { in: getSlugVariants(villageSlug) }, isActive: true },
    select: { id: true, name: true },
  });
  if (!village) notFound();

  const sourceWhere: Prisma.NewsWhereInput = source === "headman"
    ? { author: { is: { memberships: { some: { villageId: village.id, status: "ACTIVE", role: "HEADMAN" } } } } }
    : source === "resident"
      ? { author: { is: { OR: [
          { accountKind: "RESIDENT_HOUSE", residentHouseAccount: { is: { villageId: village.id } } },
          { memberships: { some: { villageId: village.id, status: "ACTIVE", role: "RESIDENT" } } },
        ] } } }
      : {};

  const publishedPublicWhere: Prisma.NewsWhereInput = {
    villageId: village.id,
    stage: "PUBLISHED",
    visibility: "PUBLIC",
    ...sourceWhere,
  };

  const newsList = await prisma.news.findMany({
    where: {
      ...publishedPublicWhere,
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
      coverUrl: true,
      imageUrls: true,
      publishedAt: true,
      createdAt: true,
      isPinned: true,
      authorId: true,
      author: {
        select: {
          accountKind: true,
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
    where: publishedPublicWhere,
    select: { title: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  const suggestionTitles = Array.from(new Set(titleSuggestions.map((item) => item.title))).slice(0, 20);
  return (
    <div className="space-y-4">
      <PublicNewsToolbar
        villageSlug={villageSlug}
        keyword={keyword}
        sort={sort}
        source={source}
        suggestionTitles={suggestionTitles}
      />

      {newsList.length === 0 ? (
        <EmptyState icon={Newspaper} title={SOURCE_EMPTY_STATE[source].title} description={SOURCE_EMPTY_STATE[source].description} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {newsList.map((news) => (
            <NewsCard
              key={news.id}
              href={`/${villageSlug}/news/${news.id}`}
              title={news.title}
              summary={news.summary}
              imageUrl={news.coverUrl || (Array.isArray(news.imageUrls) ? String(news.imageUrls[0] ?? "") : null)}
              imageCount={getNewsImageCount(news.imageUrls, news.coverUrl)}
              isPinned={news.isPinned}
              badge={<Badge variant="outline">{(() => { if (!news.authorId) return NEWS_AUTHOR_SOURCE_LABELS.UNKNOWN; const roles = news.author?.memberships.map((membershipItem) => membershipItem.role) ?? []; if (roles.includes("HEADMAN")) return NEWS_AUTHOR_SOURCE_LABELS.ADMIN; if (news.author?.accountKind === "RESIDENT_HOUSE" || roles.includes("RESIDENT")) return NEWS_AUTHOR_SOURCE_LABELS.RESIDENT; return NEWS_AUTHOR_SOURCE_LABELS.UNKNOWN; })()}</Badge>}
              meta={(news.publishedAt ?? news.createdAt).toLocaleDateString("th-TH")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
