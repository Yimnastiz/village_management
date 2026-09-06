import { Newspaper } from "lucide-react";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { NewsCard } from "@/components/news/news-card";
import { NewsMetadata } from "@/components/news/news-metadata";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { formatNewsAuthor } from "@/lib/news-author";
import { AdminNewsToolbar } from "./admin-news-toolbar";
import { getPendingNewsSubmissionCount } from "@/lib/news-submission.server";
import { getActiveSystemBroadcastTickerItems } from "@/lib/system-broadcast-ticker.server";
import { SystemBroadcastTicker } from "@/components/notifications/system-broadcast-ticker";

type PageProps = {
  searchParams?: Promise<{ q?: string; stage?: string; visibility?: string; sort?: string }>;
};

export default async function AdminNewsPage({ searchParams }: PageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const keyword = params.q?.trim() ?? "";
  const activeStage = params.stage ?? "ALL";
  const activeVisibility = params.visibility ?? "ALL";
  const activeSort = params.sort ?? "newest";

  const where: Prisma.NewsWhereInput = { villageId: membership.villageId };
  if (keyword) {
    where.OR = [
      { title: { contains: keyword, mode: "insensitive" } },
      { summary: { contains: keyword, mode: "insensitive" } },
      { content: { contains: keyword, mode: "insensitive" } },
    ];
  }
  if (activeStage !== "ALL") {
    where.stage = activeStage as "DRAFT" | "PUBLISHED" | "ARCHIVED";
  }
  if (activeVisibility !== "ALL") {
    where.visibility = activeVisibility as "PUBLIC" | "RESIDENT_ONLY";
  }

  const orderBy =
    activeSort === "oldest"
      ? [{ isPinned: "desc" as const }, { createdAt: "asc" as const }]
      : [{ isPinned: "desc" as const }, { createdAt: "desc" as const }];

  const [newsList, pendingNewsRequestCount, tickerItems] = await Promise.all([prisma.news.findMany({
    where,
    orderBy,
    select: {
      id: true,
      title: true,
      summary: true,
      coverUrl: true,
      imageUrls: true,
      stage: true,
      visibility: true,
      isPinned: true,
      authorId: true,
      publishedAt: true,
      createdAt: true,
      author: {
        select: { name: true, systemRole: true, memberships: { where: { villageId: membership.villageId, status: "ACTIVE" }, select: { role: true } } },
      },
    },
  }), getPendingNewsSubmissionCount(membership.villageId), getActiveSystemBroadcastTickerItems(session.id, "admin")]);

  const suggestionTitles = Array.from(new Set(newsList.map((news) => news.title))).slice(0, 12);

  return (
    <div data-admin-compact-top className="space-y-3">
      <AdminNewsToolbar key={`${keyword}|${activeStage}|${activeVisibility}|${activeSort}`} keyword={keyword} stage={activeStage} visibility={activeVisibility} sort={activeSort} suggestionTitles={suggestionTitles} pendingCount={pendingNewsRequestCount} />
      <SystemBroadcastTicker items={tickerItems} />

      {newsList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Newspaper className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">ยังไม่มีข่าวในระบบ</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {newsList.map((news) => (
            <NewsCard
              key={news.id}
              href={`/admin/news/${news.id}`}
              title={news.title}
              summary={news.summary}
              imageUrl={news.coverUrl || (Array.isArray(news.imageUrls) ? String(news.imageUrls[0] ?? "") : null)}
              isPinned={news.isPinned}
              metadata={<NewsMetadata stage={news.stage} visibility={news.visibility} isPinned={news.isPinned} showPinned={false} />}
              meta={`${(news.publishedAt ?? news.createdAt).toLocaleDateString("th-TH")} · ${formatNewsAuthor(news.author?.name, news.author?.systemRole, news.author?.memberships[0]?.role)}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
