import { Newspaper } from "lucide-react";
import { redirect } from "next/navigation";
import { NewsVisibility } from "@prisma/client";
import { EmptyState } from "@/components/ui/empty-state";
import { NewsMetadata } from "@/components/news/news-metadata";
import { prisma } from "@/lib/prisma";
import { getResidentVillageAccess, getSessionContextFromServerCookies } from "@/lib/access-control";
import { ResidentNewsToolbar } from "./resident-news-toolbar";
import { NewsCard } from "@/components/news/news-card";
import { formatNewsAuthor } from "@/lib/news-author";
import { residentContentVisibility } from "@/lib/resident-content-access";
import { newsDetailHref, type ResidentNewsContext } from "@/lib/resident-news-navigation";
import { getActiveSystemBroadcastTickerItems } from "@/lib/system-broadcast-ticker.server";
import { SystemBroadcastTicker } from "@/components/notifications/system-broadcast-ticker";

interface PageProps {
  searchParams: Promise<{ sort?: string; source?: string; visibility?: string; q?: string }>;
}

const SOURCE_EMPTY_STATE: Record<"all" | "admin" | "resident", { title: string; description: string }> = {
  all: {
    title: "ยังไม่มีข่าว",
    description: "ข่าวที่เผยแพร่แล้วจะแสดงที่นี่",
  },
  admin: {
    title: "ยังไม่มีข่าวจากแอดมิน",
    description: "เมื่อแอดมินเผยแพร่ข่าว ข่าวจะแสดงที่นี่",
  },
  resident: {
    title: "ยังไม่มีข่าวจากลูกบ้าน",
    description: "เมื่อมีข่าวจากลูกบ้านที่เผยแพร่แล้ว ข่าวจะแสดงที่นี่",
  },
};

export default async function ResidentNewsPage({ searchParams }: PageProps) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = await getResidentVillageAccess(session);
  if (!membership) redirect("/resident/dashboard");

  const query = await searchParams;
  const sort = query.sort === "oldest" ? "oldest" : "newest";
  const source = query.source === "admin" || query.source === "resident" ? query.source : "all";
  const visibilityParam = (query.visibility ?? "").trim();
  const requestedVisibilities = Array.from(
    new Set(
      visibilityParam
        .split(",")
        .map((value) => value.trim())
        .filter((value): value is "PUBLIC" | "RESIDENT_ONLY" =>
          value === "PUBLIC" || value === "RESIDENT_ONLY"
        )
    )
  );

  const selectedVisibilities = membership.hasResidentAccess ? requestedVisibilities : [];
  const visibilityWhereClause: NewsVisibility | { in: NewsVisibility[] } =
    !membership.hasResidentAccess
      ? NewsVisibility.PUBLIC
      : selectedVisibilities.length === 1
      ? selectedVisibilities[0]
      : { in: ["PUBLIC", "RESIDENT_ONLY"] };

  const keyword = query.q?.trim() ?? "";
  const newsContext: ResidentNewsContext = { from: "news-list", q: keyword || undefined, sort, source, visibility: [...selectedVisibilities].sort().join(",") || undefined };

  const orderBy =
    sort === "oldest"
      ? [{ isPinned: "desc" as const }, { publishedAt: "asc" as const }, { createdAt: "asc" as const }]
      : [{ isPinned: "desc" as const }, { publishedAt: "desc" as const }, { createdAt: "desc" as const }];

  const [newsList, tickerItems] = await Promise.all([
    prisma.news.findMany({
      where: {
        villageId: membership.villageId,
        stage: "PUBLISHED",
        visibility: visibilityWhereClause,
        ...(keyword ? { OR: [
          { title: { contains: keyword, mode: "insensitive" as const } },
          { author: { is: { name: { contains: keyword, mode: "insensitive" as const } } } },
        ] } : {}),
      },
      orderBy,
      select: {
        id: true,
        title: true,
        summary: true,
        coverUrl: true,
        imageUrls: true,
        visibility: true,
        isPinned: true,
        publishedAt: true,
        createdAt: true,
        authorId: true,
        author: {
          select: {
            name: true, memberships: {
              where: {
                villageId: membership.villageId,
                status: "ACTIVE",
              },
              select: { role: true },
            },
          },
        },
      },
      take: 100,
    }),
    getActiveSystemBroadcastTickerItems(session.id, "resident"),
  ]);

  const filteredNewsList = newsList.filter((newsItem) => {
    if (source === "all") return true;
    const roles = newsItem.author?.memberships.map((membershipItem) => membershipItem.role) ?? [];
    const isAdminSource = roles.some((role) => role === "HEADMAN");
    return source === "admin" ? isAdminSource : !isAdminSource;
  });

  const titleSuggestions = await prisma.news.findMany({
    where: {
      villageId: membership.villageId,
      stage: "PUBLISHED",
      visibility: residentContentVisibility(membership.hasResidentAccess),
    },
    select: { title: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  const suggestionTitles = Array.from(new Set(titleSuggestions.map((item) => item.title))).slice(0, 20);

  return (
    <div className="space-y-6">
      <ResidentNewsToolbar
        keyword={keyword}
        source={source}
        selectedVisibilities={selectedVisibilities}
        sort={sort}
      suggestionTitles={suggestionTitles}
      canSubmit={membership.hasResidentAccess}
      hasResidentAccess={membership.hasResidentAccess}
      />
      {source !== "resident" ? <SystemBroadcastTicker items={tickerItems} /> : null}

      {filteredNewsList.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title={SOURCE_EMPTY_STATE[source].title}
          description={SOURCE_EMPTY_STATE[source].description}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredNewsList.map((news) => (
            <NewsCard
              key={news.id}
              href={newsDetailHref(news.id, newsContext)}
              title={news.title}
              summary={news.summary}
              imageUrl={news.coverUrl || (Array.isArray(news.imageUrls) ? String(news.imageUrls[0] ?? "") : null)}
              isPinned={news.isPinned}
              metadata={<NewsMetadata visibility={news.visibility} isPinned={news.isPinned} showPinned={false} showStage={false} />}
              meta={`${(news.publishedAt ?? news.createdAt).toLocaleDateString("th-TH")} · ${formatNewsAuthor(news.author?.name, news.author?.memberships[0]?.role)}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
